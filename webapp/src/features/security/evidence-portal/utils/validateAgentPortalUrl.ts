// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// The Runner opens this URL in a real browser on the Engineer's machine, so
// the typed URL is checked before the login task is queued: it must be a
// public https web page.

export const EMPTY_PORTAL_URL_MESSAGE = "Please enter a URL";
export const UNPARSEABLE_PORTAL_URL_MESSAGE = "That is not a valid URL. Use the form https://...";
export const NON_HTTPS_PORTAL_URL_MESSAGE = "Only https:// URLs are allowed.";
export const CREDENTIALS_PORTAL_URL_MESSAGE = "Remove the username or password from the URL.";
export const BLOCKED_HOST_PORTAL_URL_MESSAGE = "Local and private network addresses are not allowed.";

export type ValidateAgentPortalUrlResult =
  | { valid: true; url: string }
  | { valid: false; message: string };

const BLOCKED_HOST_NAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

// [first address, prefix length] for each blocked IPv4 range.
const BLOCKED_IPV4_RANGES: [number[], number][] = [
  [[0, 0, 0, 0], 8], // "this network", including 0.0.0.0
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10], // carrier grade NAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link local, including 169.254.169.254
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15], // benchmarking
];

function ipv4ToNumber(octets: number[]): number {
  return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function isBlockedIpv4(octets: number[]): boolean {
  const address = ipv4ToNumber(octets);
  return BLOCKED_IPV4_RANGES.some(([start, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return ((address & mask) >>> 0) === ((ipv4ToNumber(start) & mask) >>> 0);
  });
}

// The URL parser has already turned shorthand, octal and hex forms such as
// 127.1 or 0x7f.0.0.1 into plain dotted decimal, so only that form is read.
function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const octets = parts.map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

// Expands the parser's compressed IPv6 form (always hex, never dotted) into
// eight 16 bit groups.
function parseIpv6(host: string): number[] | null {
  if (!host.startsWith("[") || !host.endsWith("]")) return null;
  const body = host.slice(1, -1);
  const [head, tail] = body.includes("::") ? body.split("::") : [body, null];
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const fill = tail === null ? 0 : 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array(fill).fill("0"), ...tailGroups].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

// Two 16 bit groups back into the four octets of the IPv4 they carry.
function embeddedIpv4(high: number, low: number): number[] {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isBlockedIpv6(groups: number[]): boolean {
  const firstSixZero = groups.slice(0, 6).every((g) => g === 0);
  const firstFiveZero = groups.slice(0, 5).every((g) => g === 0);
  // :: and ::1, and the IPv4 compatible form of any address
  if (firstSixZero) return true;
  // IPv4 mapped, ::ffff:a.b.c.d
  if (firstFiveZero && groups[5] === 0xffff) {
    return isBlockedIpv4(embeddedIpv4(groups[6], groups[7]));
  }
  // NAT64, 64:ff9b::a.b.c.d
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return isBlockedIpv4(embeddedIpv4(groups[6], groups[7]));
  }
  // 6to4, 2002:aabb:ccdd::/48 carries a.b.c.d
  if (groups[0] === 0x2002) {
    return isBlockedIpv4(embeddedIpv4(groups[1], groups[2]));
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // unique local, fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // link local, fe80::/10
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOST_NAMES.has(host) || host.endsWith(".localhost")) return true;
  const ipv4 = parseIpv4(host);
  if (ipv4) return isBlockedIpv4(ipv4);
  const ipv6 = parseIpv6(host);
  if (ipv6) return isBlockedIpv6(ipv6);
  return false;
}

/**
 * Checks the target portal URL an Engineer typed before the Agent Runner page
 * queues a login Agent Task for it. Returns the URL as the parser normalised
 * it, which is the form that was checked, or why it was refused so the page
 * can show the message as is.
 *
 * Plain data in, plain data out — no React, no knowledge of the page.
 */
export function validateAgentPortalUrl(input: string): ValidateAgentPortalUrlResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, message: EMPTY_PORTAL_URL_MESSAGE };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, message: UNPARSEABLE_PORTAL_URL_MESSAGE };
  }

  if (url.protocol !== "https:") {
    return { valid: false, message: NON_HTTPS_PORTAL_URL_MESSAGE };
  }

  if (url.username || url.password) {
    return { valid: false, message: CREDENTIALS_PORTAL_URL_MESSAGE };
  }

  if (!url.hostname || isBlockedHost(url.hostname)) {
    return { valid: false, message: BLOCKED_HOST_PORTAL_URL_MESSAGE };
  }

  return { valid: true, url: url.href };
}
