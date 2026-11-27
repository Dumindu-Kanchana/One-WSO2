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

// TEST DATA ONLY. A GET /admin/stats answer shaped exactly as the contract gives it, for the
// tests and for building the page before the Echo backend serves it.
//
// Not a hand-written answer: a small made-up sales team, its deals, calls, usage, decisions
// and stage history are generated once from a fixed seed, and every figure is counted from
// those rows for the range asked, the way the backend counts. So the numbers agree with each
// other in every range (calls with the weekly totals and the recorders, active users with the
// users table and the trend, regions with the people and deals) and screenshots read true.
//
// `emptyEchoAdminStats` is the opposite: a deployment with nothing in it yet.

import { MOCK_GATES } from "../../meddpicc/testing/mockGates";
import type { MergeStatus } from "../../meddpicc/types";
import type { EchoStatsClient } from "../api/echoStatsClient";
import {
  UNASSIGNED_REGION,
  type DecisionStats,
  type EchoAdminStats,
  type ProgressStats,
  type QuietDealsStats,
  type RecordingStats,
  type SalesforceStats,
  type StatsDays,
  type UsageStats,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Now" for the demo: every range ends here. */
const NOW = Date.parse("2026-11-26T10:00:00Z");
/** The generated history reaches back this far, enough for the 90-day range. */
const HISTORY_DAYS = 95;
/** Usage logging starts this day: inside the 30- and 90-day ranges, before the 7-day one. */
const USAGE_FROM_DAY = "2026-11-02";

const OPEN_STAGES = MOCK_GATES.stages.filter((stage) => !stage.startsWith("Closed"));
const WON = "Closed Won";
const LOST = "Closed Lost";

// ---- helpers ----------------------------------------------------------------

/** mulberry32: a small seeded generator, so the demo is the same on every load. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, weighted: readonly (readonly [T, number])[]): T {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
/** To the minute, without milliseconds, as the backend sends it. */
const isoInstant = (ms: number): string =>
  new Date(Math.floor(ms / 60000) * 60000).toISOString().replace(".000Z", "Z");
const midnight = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;
/** The Monday (UTC) of the ISO week holding `ms`. */
const mondayOf = (ms: number): number => midnight(ms) - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
const isWeekday = (ms: number): boolean => new Date(ms).getUTCDay() % 6 !== 0;
const regionKey = (region: string | null): string => region ?? UNASSIGNED_REGION;

/** Most of `count` first, then by name: how every list in the contract breaks ties. */
function byCountThenName<T>(count: (row: T) => number, name: (row: T) => string) {
  return (a: T, b: T) => count(b) - count(a) || name(a).localeCompare(name(b));
}

function tally<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

// ---- the made-up team and its deals -----------------------------------------

interface Person {
  email: string;
  home: string | null;
}

// Ravi owns no open deal, so his region is null and he is reported as Unassigned.
const PEOPLE: readonly Person[] = [
  { email: "amal@wso2.com", home: "APAC" },
  { email: "nadia@wso2.com", home: "APAC" },
  { email: "kasun@wso2.com", home: "APAC" },
  { email: "sophie@wso2.com", home: "EU" },
  { email: "lukas@wso2.com", home: "EU" },
  { email: "elena@wso2.com", home: "EU" },
  { email: "james@wso2.com", home: "NA" },
  { email: "olivia@wso2.com", home: "NA" },
  { email: "daniel@wso2.com", home: "NA" },
  { email: "mateo@wso2.com", home: "LATAM" },
  { email: "ana@wso2.com", home: "LATAM" },
  { email: "ravi@wso2.com", home: null },
];
const DEAL_OWNERS = PEOPLE.filter((person) => person.home !== null);

const ACCOUNTS = [
  "Brightwater Pumps", "Meridian Bank", "Nordlys Energi", "Harbourline", "Asterra Health",
  "Oakridge University", "Kestrel Telecom", "Solenne Retail", "Vantor Insurance", "Calder Rail",
  "Pinecrest Media", "Ostrava Steel", "Lumen Pay", "Rivermark Foods", "Tessaly Pharma",
  "Northgate Council", "Quayside Ports", "Altamira Mining", "Brisa Airlines", "Halden Logistics",
  "Corvid Security", "Marlow Credit Union",
] as const;
const PRODUCTS = ["API platform", "identity expansion", "integration platform", "CIAM rollout"] as const;

interface MockDeal {
  opportunityId: string;
  name: string;
  owner: Person;
  region: string | null;
  stageIndex: number;
  lastEmailAt: number | null;
  lastActivityAt: number | null;
  lastCallAt: number | null;
  /** Gate fields in scope at its stage: filled in Salesforce, or missing with or without a suggestion. */
  fields: { key: string; label: string; state: "filled" | "missing" | "proposed" }[];
}

interface ClosedDeal {
  opportunityId: string;
  name: string;
  owner: Person;
  region: string | null;
}

interface MockStageChange {
  deal: MockDeal | ClosedDeal;
  from: string;
  to: string;
  at: number;
  direction: "FORWARD" | "BACK" | "WON" | "LOST";
}

const OTHER_REGION: Record<string, string> = { APAC: "EU", EU: "APAC", NA: "LATAM", LATAM: "NA" };

function buildDeals() {
  const random = seeded(11);
  const open: MockDeal[] = Array.from({ length: 40 }, (_, i) => {
    const owner = DEAL_OWNERS[i % DEAL_OWNERS.length];
    // Mostly the owner's own region; some deals have none, a few sit in another one.
    const region = i % 9 === 4 ? null : i % 13 === 6 ? OTHER_REGION[owner.home as string] : owner.home;
    const stageIndex = Math.min(OPEN_STAGES.length - 1, Math.floor(random() ** 1.5 * OPEN_STAGES.length));
    // Most deals hear from the customer every week or two; a long tail has gone quiet.
    const lastEmailAt = random() < 0.12 ? null : NOW - random() ** 2.5 * 75 * DAY_MS;
    const lastActivityAt = Math.max(lastEmailAt ?? 0, NOW - random() * 45 * DAY_MS);
    const lastCallAt = random() < 0.25 ? null : NOW - random() * 70 * DAY_MS;
    const gateOrder = MOCK_GATES.stages;
    const fields = MOCK_GATES.fields
      .filter((field) => gateOrder.indexOf(field.gate) <= stageIndex)
      .map((field) => {
        const filled = random() < 0.4 + stageIndex * 0.07;
        const state = filled ? "filled" : random() < 0.35 ? "proposed" : "missing";
        return { key: field.key, label: field.label, state } as const;
      });
    return {
      opportunityId: `006MOCKSTAT${String(i + 1).padStart(4, "0")}`,
      name: `${ACCOUNTS[i % ACCOUNTS.length]} – ${PRODUCTS[(i + Math.floor(i / ACCOUNTS.length)) % PRODUCTS.length]}`,
      owner,
      region,
      stageIndex,
      lastEmailAt,
      lastActivityAt,
      lastCallAt,
      fields,
    };
  });

  const closed: ClosedDeal[] = Array.from({ length: 10 }, (_, i) => {
    const owner = DEAL_OWNERS[(i * 4 + 1) % DEAL_OWNERS.length];
    return {
      opportunityId: `006MOCKSTATC${String(i + 1).padStart(3, "0")}`,
      name: `${ACCOUNTS[(i * 3 + 5) % ACCOUNTS.length]} – renewal ${2026 - (i % 2)}`,
      owner,
      region: i === 7 ? null : owner.home,
    };
  });

  const changes: MockStageChange[] = [];
  for (const deal of open) {
    if (deal.stageIndex === 0) continue;
    const at = NOW - random() * 85 * DAY_MS;
    const back = deal.stageIndex < OPEN_STAGES.length - 1 && random() < 0.18;
    const from = OPEN_STAGES[back ? deal.stageIndex + 1 : deal.stageIndex - 1];
    changes.push({ deal, from, to: OPEN_STAGES[deal.stageIndex], at, direction: back ? "BACK" : "FORWARD" });
    if (!back && deal.stageIndex >= 2 && random() < 0.4) {
      const earlier = at - (3 + random() * 30) * DAY_MS;
      changes.push({
        deal,
        from: OPEN_STAGES[deal.stageIndex - 2],
        to: OPEN_STAGES[deal.stageIndex - 1],
        at: earlier,
        direction: "FORWARD",
      });
    }
  }
  closed.forEach((deal, i) => {
    const won = i < 6;
    const at = NOW - (2 + random() * 85) * DAY_MS;
    const from = OPEN_STAGES[4 + (i % 3)];
    changes.push({ deal, from, to: won ? WON : LOST, at, direction: won ? "WON" : "LOST" });
  });

  return { open, closed, changes };
}

const DEALS = buildDeals();

/** A person's region: the region most of their open deals carry; ties alphabetical; null for none. */
const PERSON_REGION: ReadonlyMap<string, string | null> = new Map(
  PEOPLE.map((person) => {
    const counts = new Map<string, number>();
    for (const deal of DEALS.open) {
      if (deal.owner.email === person.email && deal.region !== null) tally(counts, deal.region);
    }
    const [top] = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    return [person.email, top ? top[0] : null];
  }),
);
const regionOf = (email: string): string | null => PERSON_REGION.get(email) ?? null;

// ---- calls, usage and decisions ---------------------------------------------

const MEETING_TYPES = [
  ["Discovery Call", 30],
  ["Technical Call", 22],
  ["Demo Call", 18],
  ["POC Call", 9],
  ["Pricing chat", 6],
  ["Legal Chat", 3],
  ["Unspecified", 8],
] as const;

interface MockCall {
  at: number;
  host: string;
  type: string;
  transcript: boolean;
  analysed: boolean;
  failed: boolean;
  empty: boolean;
}

interface MockUsageDay {
  day: string;
  email: string;
  lastAt: number;
  actions: Record<string, number>;
}

interface MockDecision {
  at: number;
  email: string;
  fieldKey: string;
  label: string;
  outcome: "approved" | "edited" | "rejected";
  confidence: number;
  mergeStatus: MergeStatus;
  reason: string | null;
}

const DAYS = Array.from({ length: HISTORY_DAYS + 1 }, (_, i) => midnight(NOW) - (HISTORY_DAYS - i) * DAY_MS);
const DECIDED_FIELDS = MOCK_GATES.fields.slice(0, 12);

function buildCalls(): MockCall[] {
  const random = seeded(23);
  const calls: MockCall[] = [];
  for (const day of DAYS) {
    if (!isWeekday(day)) continue;
    for (const person of PEOPLE) {
      const count = random() < 0.24 ? (random() < 0.15 ? 2 : 1) : 0;
      for (let n = 0; n < count; n++) {
        const at = day + (8 + random() * 9) * 60 * 60 * 1000;
        if (at > NOW) continue;
        const transcript = random() < 0.86;
        const roll = random();
        const empty = transcript && roll < 0.04;
        const failedFirst = transcript && !empty && roll < 0.08;
        const analysed = transcript && !empty && !failedFirst && roll < 0.95;
        // A finished analysis whose later re-analysis failed counts in both.
        const failed = failedFirst || (analysed && random() < 0.05);
        calls.push({ at, host: person.email, type: pick(random, MEETING_TYPES), transcript, analysed, failed, empty });
      }
    }
  }
  return calls;
}

function buildUsage(): MockUsageDay[] {
  const random = seeded(37);
  const rows: MockUsageDay[] = [];
  // Ana and Mateo have not opened Echo yet; Ravi rarely does.
  const activity: Record<string, number> = { "ana@wso2.com": 0, "mateo@wso2.com": 0, "ravi@wso2.com": 0.15 };
  for (const day of DAYS) {
    const date = isoDate(day);
    if (date < USAGE_FROM_DAY || !isWeekday(day)) continue;
    for (const person of PEOPLE) {
      // The first morning, the first person in: that is when tracking started.
      const first = date === USAGE_FROM_DAY && person.email === "amal@wso2.com";
      if (!first && random() >= (activity[person.email] ?? 0.62)) continue;
      const lastAt = Math.min(NOW, day + (9 + random() * 8) * 60 * 60 * 1000);
      if (day + 9 * 60 * 60 * 1000 > NOW) continue;
      const actions: Record<string, number> = {
        "deal.view": 2 + Math.floor(random() * 14),
        "deal.approve": random() < 0.4 ? 1 + Math.floor(random() * 3) : 0,
        "deal.reject": random() < 0.2 ? 1 : 0,
        "deal.ask": random() < 0.35 ? 1 + Math.floor(random() * 2) : 0,
        "meeting.reanalyse": random() < 0.1 ? 1 : 0,
        "deals.list": 1 + Math.floor(random() * 6),
        "meetings.coverage": Math.floor(random() * 4),
      };
      rows.push({ day: date, email: person.email, lastAt, actions });
    }
  }
  return rows;
}

const REJECT_REASON_WEIGHTS = [
  ["WRONG_VALUE", 40],
  ["NOT_SUPPORTED", 25],
  ["OUTDATED", 15],
  ["WRONG_PERSON", 10],
  ["OTHER", 7],
  ["UNSPECIFIED", 3],
] as const;

/**
 * What AMs decided. Before usage tracking started there is no log to agree with, so decisions
 * are drawn per person and day. From then on each one comes from a logged request: an approve
 * decides one to three fields (as proposed, or edited), a reject turns down one. So the Users
 * table's approvals and rejections and the decisions by user tell the same story.
 */
function buildDecisions(usage: readonly MockUsageDay[]): MockDecision[] {
  const random = seeded(53);
  const rows: MockDecision[] = [];
  const decide = (at: number, email: string, outcome: MockDecision["outcome"]) => {
    const field = DECIDED_FIELDS[Math.floor(random() * DECIDED_FIELDS.length)];
    // Rejected suggestions lean towards lower confidence, as they would.
    const confidence = outcome === "rejected" ? 0.45 + random() * 0.4 : 0.55 + random() * 0.45;
    rows.push({
      at,
      email,
      fieldKey: field.key,
      label: field.label,
      outcome,
      confidence,
      mergeStatus: pick(random, [["SINGLE", 60], ["MERGED", 32], ["FALLBACK", 8]] as const),
      reason: outcome === "rejected" ? pick(random, REJECT_REASON_WEIGHTS) : null,
    });
  };
  const approvedOrEdited = (): MockDecision["outcome"] => (random() < 0.22 ? "edited" : "approved");

  const decisionChance: Record<string, number> = { "ana@wso2.com": 0, "mateo@wso2.com": 0, "ravi@wso2.com": 0.05 };
  for (const day of DAYS) {
    if (!isWeekday(day) || isoDate(day) >= USAGE_FROM_DAY) continue;
    for (const person of PEOPLE) {
      if (random() >= (decisionChance[person.email] ?? 0.3)) continue;
      const count = 1 + Math.floor(random() * 4);
      for (let n = 0; n < count; n++) {
        const at = day + (9 + random() * 8) * 60 * 60 * 1000;
        decide(at, person.email, random() < 0.12 ? "rejected" : approvedOrEdited());
      }
    }
  }

  for (const row of usage) {
    for (let n = 0; n < (row.actions["deal.approve"] ?? 0); n++) {
      const fields = 1 + Math.floor(random() * 3);
      for (let f = 0; f < fields; f++) decide(row.lastAt, row.email, approvedOrEdited());
    }
    for (let n = 0; n < (row.actions["deal.reject"] ?? 0); n++) decide(row.lastAt, row.email, "rejected");
  }
  return rows;
}

const CALLS = buildCalls();
const USAGE = buildUsage();
const DECISIONS = buildDecisions(USAGE);

// ---- the answer, counted for one range --------------------------------------

/** The range the backend answers for `days`: from 00:00 UTC `days` days ago to now. */
function rangeFor(days: StatsDays): EchoAdminStats["range"] {
  return { from: isoInstant(midnight(NOW) - days * DAY_MS), to: isoInstant(NOW), days };
}

/** Every day in range, oldest first; the last is today, so far. */
function daysIn(from: number): string[] {
  const out: string[] = [];
  for (let day = from; day <= NOW; day += DAY_MS) out.push(isoDate(day));
  return out;
}

/** The Mondays of the ISO weeks touching the range, oldest first. */
function weeksIn(from: number): string[] {
  const out: string[] = [];
  for (let week = mondayOf(from); week <= NOW; week += 7 * DAY_MS) out.push(isoDate(week));
  return out;
}

function usageFor(from: number): UsageStats {
  const fromDay = isoDate(from);
  const rows = USAGE.filter((row) => row.day >= fromDay);
  const eventsOf = (row: MockUsageDay) => Object.values(row.actions).reduce((sum, n) => sum + n, 0);

  const daily = daysIn(from).map((date) => {
    const today = rows.filter((row) => row.day === date);
    return { date, users: today.length, events: today.reduce((sum, row) => sum + eventsOf(row), 0) };
  });
  const weekly = weeksIn(from).map((weekStart) => {
    const end = isoDate(Date.parse(`${weekStart}T00:00:00Z`) + 7 * DAY_MS);
    const week = rows.filter((row) => row.day >= weekStart && row.day < end);
    return {
      weekStart,
      users: new Set(week.map((row) => row.email)).size,
      events: week.reduce((sum, row) => sum + eventsOf(row), 0),
    };
  });

  const people = new Map<string, UsageStats["users"][number]>();
  for (const row of rows) {
    const user = people.get(row.email) ?? {
      email: row.email,
      region: regionOf(row.email),
      lastSeen: "",
      events: 0,
      dealViews: 0,
      approvals: 0,
      rejections: 0,
      asks: 0,
      reanalyses: 0,
    };
    user.events += eventsOf(row);
    user.dealViews += row.actions["deal.view"] ?? 0;
    user.approvals += row.actions["deal.approve"] ?? 0;
    user.rejections += row.actions["deal.reject"] ?? 0;
    user.asks += row.actions["deal.ask"] ?? 0;
    user.reanalyses += row.actions["meeting.reanalyse"] ?? 0;
    const seen = isoInstant(row.lastAt);
    if (seen > user.lastSeen) user.lastSeen = seen;
    people.set(row.email, user);
  }
  const users = [...people.values()].sort(byCountThenName((u) => u.events, (u) => u.email)).slice(0, 200);

  const actionEvents = new Map<string, number>();
  const actionUsers = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const [action, n] of Object.entries(row.actions)) {
      if (n === 0) continue;
      tally(actionEvents, action, n);
      actionUsers.set(action, (actionUsers.get(action) ?? new Set()).add(row.email));
    }
  }
  const byAction = [...actionEvents]
    .map(([action, events]) => ({ action, events, users: actionUsers.get(action)?.size ?? 0 }))
    .sort(byCountThenName((a) => a.events, (a) => a.action));

  const regionUsers = new Map<string, number>();
  const regionEvents = new Map<string, number>();
  for (const user of users) {
    tally(regionUsers, regionKey(user.region));
    tally(regionEvents, regionKey(user.region), user.events);
  }
  const byRegion = [...regionUsers]
    .map(([region, n]) => ({ region, users: n, events: regionEvents.get(region) ?? 0 }))
    .sort(byCountThenName((r) => r.users, (r) => r.region));

  const firstUse = Math.min(...USAGE.map((row) => Date.parse(`${row.day}T09:00:00Z`)));
  return {
    trackedSince: isoInstant(firstUse),
    activeUsers: users.length,
    daily,
    weekly,
    users,
    byAction,
    byRegion,
  };
}

function recordingFor(from: number): RecordingStats {
  const calls = CALLS.filter((call) => call.at >= from);
  const recorders = new Map<string, RecordingStats["byRecorder"][number]>();
  for (const call of calls) {
    const row = recorders.get(call.host) ?? {
      email: call.host,
      region: regionOf(call.host),
      calls: 0,
      withTranscript: 0,
      analysed: 0,
      lastCallAt: null,
    };
    row.calls += 1;
    if (call.transcript) row.withTranscript += 1;
    if (call.analysed) row.analysed += 1;
    const at = isoInstant(call.at);
    if (!row.lastCallAt || at > row.lastCallAt) row.lastCallAt = at;
    recorders.set(call.host, row);
  }
  const byRecorder = [...recorders.values()].sort(byCountThenName((r) => r.calls, (r) => r.email)).slice(0, 200);

  const types = new Map<string, number>();
  for (const call of calls) tally(types, call.type);
  const byMeetingType = [...types]
    .map(([type, n]) => ({ type, calls: n }))
    .sort(byCountThenName((t) => t.calls, (t) => t.type));

  const weekly = weeksIn(from).map((weekStart) => {
    const start = Date.parse(`${weekStart}T00:00:00Z`);
    const week = calls.filter((call) => call.at >= start && call.at < start + 7 * DAY_MS);
    return { weekStart, calls: week.length, analysed: week.filter((call) => call.analysed).length };
  });

  const regions = new Map<string, { region: string; calls: number; analysed: number; recorders: number }>();
  for (const recorder of byRecorder) {
    const key = regionKey(recorder.region);
    const row = regions.get(key) ?? { region: key, calls: 0, analysed: 0, recorders: 0 };
    row.calls += recorder.calls;
    row.analysed += recorder.analysed;
    row.recorders += 1;
    regions.set(key, row);
  }

  return {
    calls: calls.length,
    withTranscript: calls.filter((call) => call.transcript).length,
    analysed: calls.filter((call) => call.analysed).length,
    failed: calls.filter((call) => call.failed).length,
    emptyTranscript: calls.filter((call) => call.empty).length,
    recorders: recorders.size,
    byRecorder,
    byMeetingType,
    weekly,
    byRegion: [...regions.values()].sort(byCountThenName((r) => r.calls, (r) => r.region)),
  };
}

/** Salesforce completeness of the open deals, now: the same in every range. */
function salesforceNow(): SalesforceStats {
  const all = DEALS.open.flatMap((deal) => deal.fields);
  const filled = all.filter((field) => field.state === "filled").length;
  const fields = new Map<string, SalesforceStats["byField"][number]>();
  for (const field of all) {
    const row = fields.get(field.key) ?? {
      fieldKey: field.key,
      label: field.label,
      dealsInScope: 0,
      filled: 0,
      missing: 0,
      echoProposed: 0,
    };
    row.dealsInScope += 1;
    if (field.state === "filled") row.filled += 1;
    else row.missing += 1;
    if (field.state === "proposed") row.echoProposed += 1;
    fields.set(field.key, row);
  }
  const dealsWithMostGaps = DEALS.open
    .map((deal) => ({
      opportunityId: deal.opportunityId,
      name: deal.name,
      ownerEmail: deal.owner.email,
      stage: OPEN_STAGES[deal.stageIndex],
      inScope: deal.fields.length,
      missing: deal.fields.filter((field) => field.state !== "filled").length,
      echoProposed: deal.fields.filter((field) => field.state === "proposed").length,
    }))
    .filter((deal) => deal.missing > 0)
    .sort(byCountThenName((d) => d.missing, (d) => d.name))
    .slice(0, 25);
  return {
    asOf: isoInstant(NOW),
    deals: DEALS.open.length,
    fieldsInScope: all.length,
    fieldsFilled: filled,
    fieldsMissing: all.length - filled,
    fillRate: all.length === 0 ? null : Math.round((filled / all.length) * 1000) / 1000,
    echoCanFill: all.filter((field) => field.state === "proposed").length,
    byField: [...fields.values()].sort(byCountThenName((f) => f.missing, (f) => f.label)),
    dealsWithMostGaps,
  };
}

const rate = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;

function decisionsFor(from: number, salesforce: SalesforceStats): DecisionStats {
  const rows = DECISIONS.filter((row) => row.at >= from);
  const count = (list: MockDecision[], outcome: MockDecision["outcome"]) =>
    list.filter((row) => row.outcome === outcome).length;
  const asIs = (list: MockDecision[]) => rate(count(list, "approved"), list.length);
  const groupBy = (key: (row: MockDecision) => string) => {
    const groups = new Map<string, MockDecision[]>();
    for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
    return groups;
  };

  // Pending: every suggestion waiting now. The ones on open deals' missing fields, as the
  // Salesforce card counts them, plus a few on fields Salesforce already holds a value for.
  const pendingByField = new Map(salesforce.byField.map((f) => [f.fieldKey, f.echoProposed]));
  for (const [i, field] of DECIDED_FIELDS.entries()) tally(pendingByField, field.key, i % 3);
  const labels = new Map(MOCK_GATES.fields.map((field) => [field.key, field.label]));

  const byFieldGroups = groupBy((row) => row.fieldKey);
  const byField = [...new Set([...byFieldGroups.keys(), ...[...pendingByField].filter(([, n]) => n > 0).map(([k]) => k)])]
    .map((fieldKey) => {
      const list = byFieldGroups.get(fieldKey) ?? [];
      return {
        fieldKey,
        label: labels.get(fieldKey) ?? fieldKey,
        approved: count(list, "approved"),
        edited: count(list, "edited"),
        rejected: count(list, "rejected"),
        pending: pendingByField.get(fieldKey) ?? 0,
        approvedAsIsRate: asIs(list),
      };
    })
    .sort(byCountThenName((f) => f.approved + f.edited + f.rejected, (f) => f.label));

  const reasons = new Map<string, number>();
  for (const row of rows) if (row.reason) tally(reasons, row.reason);

  const bandOf = (confidence: number) => {
    const lower = Math.min(9, Math.floor(confidence * 10));
    return `${(lower / 10).toFixed(1)}-${((lower + 1) / 10).toFixed(1)}`;
  };
  const bands = groupBy((row) => bandOf(row.confidence));
  const merges = groupBy((row) => row.mergeStatus);
  const users = groupBy((row) => row.email);

  return {
    approved: count(rows, "approved"),
    edited: count(rows, "edited"),
    rejected: count(rows, "rejected"),
    pending: [...pendingByField.values()].reduce((sum, n) => sum + n, 0),
    approvedAsIsRate: asIs(rows),
    byField,
    rejectReasons: [...reasons]
      .map(([reason, n]) => ({ reason, count: n }))
      .sort(byCountThenName((r) => r.count, (r) => r.reason)),
    byConfidence: [...bands]
      .map(([band, list]) => ({ band, decided: list.length, approvedAsIsRate: asIs(list) }))
      .sort((a, b) => a.band.localeCompare(b.band)),
    byMergeStatus: [...merges]
      .map(([mergeStatus, list]) => ({
        mergeStatus: mergeStatus as MergeStatus,
        decided: list.length,
        approvedAsIsRate: asIs(list),
      }))
      .sort(byCountThenName((m) => m.decided, (m) => m.mergeStatus)),
    byUser: [...users]
      .map(([email, list]) => ({
        email,
        region: regionOf(email),
        approved: count(list, "approved"),
        edited: count(list, "edited"),
        rejected: count(list, "rejected"),
      }))
      .sort(byCountThenName((u) => u.approved + u.edited + u.rejected, (u) => u.email))
      .slice(0, 200),
  };
}

function progressFor(from: number): ProgressStats {
  const inRange = DEALS.changes.filter((change) => change.at >= from).sort((a, b) => b.at - a.at);
  // A deal's latest change in range decides whether it moved forward or back.
  const latest = new Map<string, MockStageChange>();
  for (const change of inRange) if (!latest.has(change.deal.opportunityId)) latest.set(change.deal.opportunityId, change);
  const moved = [...latest.values()];
  const reached = (direction: "WON" | "LOST") =>
    new Set(inRange.filter((c) => c.direction === direction).map((c) => c.deal.opportunityId));
  const won = reached("WON");
  const lost = reached("LOST");

  const byStage = OPEN_STAGES.map((stage, index) => ({
    stage,
    deals: DEALS.open.filter((deal) => deal.stageIndex === index).length,
  })).filter((row) => row.deals > 0);

  type Totals = { openDeals: number; stageChanges: number; closedWon: number; closedLost: number };
  const zero = (): Totals => ({ openDeals: 0, stageChanges: 0, closedWon: 0, closedLost: 0 });
  const regions = new Map<string, Totals>();
  const owners = new Map<string, Totals>();
  const add = (deal: MockDeal | ClosedDeal, field: keyof Totals) => {
    const region = regions.get(regionKey(deal.region)) ?? zero();
    region[field] += 1;
    regions.set(regionKey(deal.region), region);
    const owner = owners.get(deal.owner.email) ?? zero();
    owner[field] += 1;
    owners.set(deal.owner.email, owner);
  };
  for (const deal of DEALS.open) add(deal, "openDeals");
  for (const change of moved) add(change.deal, "stageChanges");
  for (const deal of [...DEALS.closed]) {
    if (won.has(deal.opportunityId)) add(deal, "closedWon");
    if (lost.has(deal.opportunityId)) add(deal, "closedLost");
  }

  return {
    asOf: isoInstant(NOW),
    openDeals: DEALS.open.length,
    byStage,
    stageChanges: latest.size,
    movedForward: moved.filter((c) => c.direction === "FORWARD").length,
    movedBack: moved.filter((c) => c.direction === "BACK").length,
    closedWon: won.size,
    closedLost: lost.size,
    changes: inRange.slice(0, 50).map((change) => ({
      opportunityId: change.deal.opportunityId,
      name: change.deal.name,
      ownerEmail: change.deal.owner.email,
      region: change.deal.region,
      from: change.from,
      to: change.to,
      at: isoInstant(change.at),
      direction: change.direction,
    })),
    byRegion: [...regions]
      .map(([region, totals]) => ({ region, ...totals }))
      .sort(byCountThenName((r) => r.openDeals, (r) => r.region)),
    byOwner: [...owners]
      .map(([ownerEmail, totals]) => ({ ownerEmail, region: regionOf(ownerEmail), ...totals }))
      .sort(byCountThenName((o) => o.openDeals, (o) => o.ownerEmail))
      .slice(0, 200),
  };
}

function quietDealsFor(from: number): QuietDealsStats {
  const quiet = DEALS.open.filter((deal) => deal.lastEmailAt === null || deal.lastEmailAt < from);
  const deals = [...quiet]
    .sort(
      (a, b) =>
        (a.lastEmailAt === null ? -1 : 0) - (b.lastEmailAt === null ? -1 : 0) ||
        (a.lastEmailAt ?? 0) - (b.lastEmailAt ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 100)
    .map((deal) => ({
      opportunityId: deal.opportunityId,
      name: deal.name,
      ownerEmail: deal.owner.email,
      region: deal.region,
      stage: OPEN_STAGES[deal.stageIndex],
      lastEmailAt: deal.lastEmailAt === null ? null : isoInstant(deal.lastEmailAt),
      lastActivityAt: deal.lastActivityAt === null ? null : isoInstant(deal.lastActivityAt),
      lastCallAt: deal.lastCallAt === null ? null : isoInstant(deal.lastCallAt),
    }));
  const isQuiet = new Set(quiet.map((deal) => deal.opportunityId));

  const owners = new Map<string, { openDeals: number; quiet: number }>();
  const regions = new Map<string, { openDeals: number; quiet: number }>();
  for (const deal of DEALS.open) {
    for (const [map, key] of [
      [owners, deal.owner.email],
      [regions, regionKey(deal.region)],
    ] as const) {
      const row = map.get(key) ?? { openDeals: 0, quiet: 0 };
      row.openDeals += 1;
      if (isQuiet.has(deal.opportunityId)) row.quiet += 1;
      map.set(key, row);
    }
  }

  return {
    asOf: isoInstant(NOW),
    openDeals: DEALS.open.length,
    quiet: quiet.length,
    deals,
    byOwner: [...owners]
      .map(([ownerEmail, row]) => ({ ownerEmail, region: regionOf(ownerEmail), ...row }))
      .sort(byCountThenName((o) => o.quiet, (o) => o.ownerEmail))
      .slice(0, 200),
    byRegion: [...regions]
      .map(([region, row]) => ({ region, ...row }))
      .sort(byCountThenName((r) => r.quiet, (r) => r.region)),
  };
}

export function mockEchoAdminStats(days: StatsDays = 30): EchoAdminStats {
  const range = rangeFor(days);
  const from = Date.parse(range.from);
  const salesforce = salesforceNow();
  return {
    range,
    usage: usageFor(from),
    recording: recordingFor(from),
    decisions: decisionsFor(from, salesforce),
    salesforce,
    // Still in the contract, not shown on the page.
    model: {
      calls: 400,
      failed: 3,
      inputTokens: 9000000,
      outputTokens: 400000,
      cacheReadTokens: 2000000,
      cacheWriteTokens: 900000,
      byPurpose: [
        { purpose: "call.vote", calls: 200, failed: 1, inputTokens: 6000000, outputTokens: 300000, cacheReadTokens: 1500000 },
      ],
    },
    progress: progressFor(from),
    quietDeals: quietDealsFor(from),
  };
}

/** A deployment with nothing in it yet: no usage, no calls, no decisions, no open deals. */
export function emptyEchoAdminStats(days: StatsDays = 30): EchoAdminStats {
  const range = rangeFor(days);
  const from = Date.parse(range.from);
  return {
    range,
    usage: {
      trackedSince: null,
      activeUsers: 0,
      daily: daysIn(from).map((date) => ({ date, users: 0, events: 0 })),
      weekly: weeksIn(from).map((weekStart) => ({ weekStart, users: 0, events: 0 })),
      users: [],
      byAction: [],
      byRegion: [],
    },
    recording: {
      calls: 0,
      withTranscript: 0,
      analysed: 0,
      failed: 0,
      emptyTranscript: 0,
      recorders: 0,
      byRecorder: [],
      byMeetingType: [],
      weekly: weeksIn(from).map((weekStart) => ({ weekStart, calls: 0, analysed: 0 })),
      byRegion: [],
    },
    decisions: {
      approved: 0,
      edited: 0,
      rejected: 0,
      pending: 0,
      approvedAsIsRate: null,
      byField: [],
      rejectReasons: [],
      byConfidence: [],
      byMergeStatus: [],
      byUser: [],
    },
    salesforce: {
      asOf: isoInstant(NOW),
      deals: 0,
      fieldsInScope: 0,
      fieldsFilled: 0,
      fieldsMissing: 0,
      fillRate: null,
      echoCanFill: 0,
      byField: [],
      dealsWithMostGaps: [],
    },
    model: {
      calls: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      byPurpose: [],
    },
    progress: {
      asOf: isoInstant(NOW),
      openDeals: 0,
      byStage: [],
      stageChanges: 0,
      movedForward: 0,
      movedBack: 0,
      closedWon: 0,
      closedLost: 0,
      changes: [],
      byRegion: [],
      byOwner: [],
    },
    quietDeals: { asOf: isoInstant(NOW), openDeals: 0, quiet: 0, deals: [], byOwner: [], byRegion: [] },
  };
}

/** The demo implementation of GET /admin/stats. */
export const mockEchoStatsClient: EchoStatsClient = {
  adminStats: async (days) => structuredClone(mockEchoAdminStats(days)),
};
