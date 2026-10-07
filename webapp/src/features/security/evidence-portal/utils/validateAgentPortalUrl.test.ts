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

import { describe, expect, test } from "vitest";
import {
  BLOCKED_HOST_PORTAL_URL_MESSAGE,
  CREDENTIALS_PORTAL_URL_MESSAGE,
  EMPTY_PORTAL_URL_MESSAGE,
  NON_HTTPS_PORTAL_URL_MESSAGE,
  UNPARSEABLE_PORTAL_URL_MESSAGE,
  validateAgentPortalUrl,
} from "./validateAgentPortalUrl";

describe("validateAgentPortalUrl", () => {
  test.each([
    ["the Azure Portal preset", "https://portal.azure.com", "https://portal.azure.com/"],
    ["the AWS Console preset", "https://console.aws.amazon.com", "https://console.aws.amazon.com/"],
    ["the WSO2 Identity Server Cloud preset", "https://console.asgardeo.io", "https://console.asgardeo.io/"],
    ["a public custom URL with a path", "https://github.com/orgs/wso2/settings", "https://github.com/orgs/wso2/settings"],
    ["a URL with spaces around it", "  https://portal.azure.com  ", "https://portal.azure.com/"],
    ["a public address just below 172.16.0.0/12", "https://172.15.255.255", "https://172.15.255.255/"],
    ["a public address just above 172.16.0.0/12", "https://172.32.0.1", "https://172.32.0.1/"],
    ["a public address just above 100.64.0.0/10", "https://100.128.0.1", "https://100.128.0.1/"],
    ["a public address just below 169.254.0.0/16", "https://169.253.255.255", "https://169.253.255.255/"],
    ["a public IPv6 address", "https://[2606:4700::1111]", "https://[2606:4700::1111]/"],
    ["a public IPv4 mapped IPv6 address", "https://[::ffff:8.8.8.8]", "https://[::ffff:808:808]/"],
  ])("accepts %s", (_, input, url) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: true, url });
  });

  test.each([
    ["an empty box", ""],
    ["only spaces", "   "],
  ])("refuses %s with the existing message", (_, input) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: false, message: EMPTY_PORTAL_URL_MESSAGE });
  });

  test.each([
    ["text that is not a URL", "not a url"],
    ["a host with no scheme", "portal.azure.com"],
  ])("refuses %s as unparseable", (_, input) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: false, message: UNPARSEABLE_PORTAL_URL_MESSAGE });
  });

  test.each([
    ["plain http", "http://portal.azure.com"],
    ["file", "file:///etc/passwd"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/html,<h1>hi</h1>"],
    ["ftp", "ftp://example.com"],
    ["chrome", "chrome://settings"],
  ])("refuses the %s scheme", (_, input) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: false, message: NON_HTTPS_PORTAL_URL_MESSAGE });
  });

  test.each([
    ["a username and password", "https://user:secret@portal.azure.com"],
    ["a username only", "https://user@portal.azure.com"],
  ])("refuses a URL with %s", (_, input) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: false, message: CREDENTIALS_PORTAL_URL_MESSAGE });
  });

  test.each([
    ["localhost", "https://localhost"],
    ["localhost with a port", "https://localhost:8000"],
    ["localhost in capitals", "https://LOCALHOST"],
    ["localhost with a trailing dot", "https://localhost."],
    ["a .localhost name", "https://app.localhost"],
    ["the GCP metadata name", "https://metadata.google.internal"],
    ["the short metadata name", "https://metadata"],
    ["the AWS metadata name", "https://instance-data.ec2.internal"],
    ["0.0.0.0", "https://0.0.0.0"],
    ["127.0.0.1", "https://127.0.0.1"],
    ["the top of 127.0.0.0/8", "https://127.255.255.255"],
    ["the bottom of 10.0.0.0/8", "https://10.0.0.0"],
    ["the top of 10.0.0.0/8", "https://10.255.255.255"],
    ["the bottom of 172.16.0.0/12", "https://172.16.0.0"],
    ["the top of 172.16.0.0/12", "https://172.31.255.255"],
    ["the bottom of 192.168.0.0/16", "https://192.168.0.0"],
    ["the top of 192.168.0.0/16", "https://192.168.255.255"],
    ["the cloud metadata IP", "https://169.254.169.254"],
    ["the bottom of 169.254.0.0/16", "https://169.254.0.0"],
    ["the bottom of 100.64.0.0/10", "https://100.64.0.0"],
    ["the top of 100.64.0.0/10", "https://100.127.255.255"],
    ["shorthand loopback", "https://127.1"],
    ["hex loopback", "https://0x7f.0.0.1"],
    ["octal loopback", "https://0177.0.0.1"],
    ["loopback as one number", "https://2130706433"],
    ["the metadata IP as one hex number", "https://0xa9fea9fe"],
    ["IPv6 loopback", "https://[::1]"],
    ["IPv6 unspecified", "https://[::]"],
    ["IPv6 unique local fc00::/7", "https://[fd12:3456::1]"],
    ["IPv6 unique local at fc00", "https://[fc00::1]"],
    ["IPv6 link local", "https://[fe80::1]"],
    ["IPv6 link local at the top of fe80::/10", "https://[febf::1]"],
    ["IPv4 mapped loopback", "https://[::ffff:127.0.0.1]"],
    ["IPv4 mapped metadata IP", "https://[::ffff:169.254.169.254]"],
    ["IPv4 mapped private address", "https://[::ffff:10.0.0.1]"],
  ])("refuses %s", (_, input) => {
    expect(validateAgentPortalUrl(input)).toEqual({ valid: false, message: BLOCKED_HOST_PORTAL_URL_MESSAGE });
  });
});
