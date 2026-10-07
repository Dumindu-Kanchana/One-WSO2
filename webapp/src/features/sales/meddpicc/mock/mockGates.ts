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

// TEST DATA ONLY. The Gate definitions the test double serves as GET /gates, and
// derives its deals from. The real list lives in echo-backend's gates.json and
// reaches the live screens through the API; nothing outside ../mock reads this.
//
// Only what the screen shows is copied: labels, kinds, options and the Ask next
// questions. The backend's model guidance and Salesforce API names are not.

import type { GateFieldDefinition, GatesResponse } from "../types";
import { LETTERS } from "../util/meddpiccFormat";

const YES_NO = ["YES", "NO"];

const FIELDS: GateFieldDefinition[] = [
  // ---- Validate --------------------------------------------------------------
  {
    key: "successCriteriaPain",
    gate: "Validate",
    label: "Customer success criteria and pain",
    letters: ["M", "I"],
    kind: "text",
    conversational: true,
    askNext:
      "What does success look like for you in numbers, and what does it cost you today if this problem isn't solved?",
  },
  {
    key: "salesPlays",
    gate: "Validate",
    label: "Sales plays",
    letters: ["I"],
    kind: "multiPicklist",
    conversational: true,
    options: [
      "AI & MCP Readiness Acceleration",
      "AI Agent Governance and Control",
      "API & AI Revenue Acceleration",
      "Boomi migration",
      "Competitive displacement",
      "IAM federation",
      "Mulesoft migration",
      "Unified API governance",
      "Vendor Consolidation",
      "No Sales Plays",
    ],
    askNext: "What are you replacing or consolidating, and what's driving the change now?",
  },
  {
    key: "primaryContact",
    gate: "Validate",
    label: "Primary contact",
    letters: [],
    kind: "role",
    role: "Primary Contact",
    conversational: true,
    askNext: "Who will be our main point of contact on your side for this project?",
  },
  // ---- Qualify ---------------------------------------------------------------
  {
    key: "economicBuyer",
    gate: "Qualify",
    label: "Economic buyer",
    letters: ["E"],
    kind: "role",
    role: "Economic Buyer",
    conversational: true,
    askNext: "Who owns the budget for this, and who has to sign off on the spend?",
  },
  {
    key: "champion",
    gate: "Qualify",
    label: "Champion",
    letters: ["CH"],
    kind: "role",
    role: "Champion",
    conversational: true,
    askNext:
      "Who on your side is pushing hardest for this project, and how can we help them make the case internally?",
  },
  {
    key: "decisionProcess",
    gate: "Qualify",
    label: "Decision process",
    letters: ["DP"],
    kind: "multiPicklist",
    conversational: true,
    options: [
      "RFP",
      "RFI",
      "RFQ",
      "Public Tender",
      "Direct Award",
      "Validation by Evaluation and/or buying Committee",
      "POC",
      "Security Review Required",
    ],
    askNext:
      "Walk me through how you'll choose a vendor: is there an RFP, a committee, a POC or a security review?",
  },
  {
    key: "paperProcess",
    gate: "Qualify",
    label: "Paper process",
    letters: ["P"],
    kind: "multiPicklist",
    conversational: true,
    options: ["Direct Award", "WSO2 Invoice", "PO Required", "Customer Portal", "Mandatory Legal Review"],
    askNext:
      "Once you've decided, what does purchasing look like: a PO, a procurement portal, legal review? How long does it usually take?",
  },
  {
    key: "decisionCriteria",
    gate: "Qualify",
    label: "Decision criteria",
    letters: ["DC"],
    kind: "multiPicklist",
    conversational: true,
    options: [
      "Total cost of ownership",
      "Technical fit / feature coverage",
      "Security & compliance certs",
      "Scalability & performance",
      "Ease of integration / TTV",
      "Vendor stability & support",
      "Open source / licensing model",
      "Developer experience & docs",
      "Other",
    ],
    askNext: "What matters most when you compare vendors: cost, technical fit, security, scalability, licensing?",
  },
  {
    key: "productLineItems",
    gate: "Qualify",
    label: "Product line items",
    letters: ["DC"],
    kind: "salesforceOnly",
    conversational: false,
  },
  {
    key: "salesEngineer",
    gate: "Qualify",
    label: "Sales engineer assigned",
    letters: [],
    kind: "salesforceOnly",
    conversational: false,
  },
  // ---- Technical Proof -------------------------------------------------------
  {
    key: "pocRequired",
    gate: "Technical Proof",
    label: "POC required",
    letters: ["DC"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    askNext: "Will you need a proof of concept before making a decision?",
  },
  {
    key: "pocCompleted",
    gate: "Technical Proof",
    label: "POC completed",
    letters: ["DC"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    dependsOn: { field: "pocRequired", equals: "YES" },
    askNext: "Where are we with the POC: is it complete, and did it meet your success criteria?",
  },
  {
    key: "useCaseFit",
    gate: "Technical Proof",
    label: "WSO2–customer use case fit",
    letters: ["DC"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    askNext: "Does what you've seen so far cover your use case, or are there gaps we should look at?",
  },
  {
    key: "competitors",
    gate: "Technical Proof",
    label: "Competitors",
    letters: ["CO"],
    kind: "multiPicklist",
    conversational: true,
    options: ["Ping", "Mulesoft", "Gravitee", "Kong", "Oracle", "IBM", "APIgee", "Forgerock", "Okta", "Other", "Not Identified"],
    askNext: "Who else are you looking at, or are you considering building this yourselves?",
  },
  {
    key: "infrastructure",
    gate: "Technical Proof",
    label: "Customer's infrastructure",
    letters: ["DC"],
    kind: "multiPicklist",
    conversational: true,
    options: ["Cloud", "Self-hosted", "Hybrid"],
    askNext: "Where would you run this: in the cloud, self-hosted, or a mix?",
  },
  {
    key: "cloudProvider",
    gate: "Technical Proof",
    label: "Cloud service provider",
    letters: ["DC"],
    kind: "multiPicklist",
    conversational: true,
    options: ["AWS", "Azure", "GCP", "Other"],
    dependsOn: { field: "infrastructure", includes: "Cloud" },
    askNext: "Which cloud provider are you on?",
  },
  {
    key: "infrastructurePlatform",
    gate: "Technical Proof",
    label: "Infrastructure platform",
    letters: ["DC"],
    kind: "multiPicklist",
    conversational: true,
    optional: true,
    options: ["Oracle", "Openshift", "Nutanix", "Other"],
    askNext: "What platform do you run your workloads on, for example OpenShift or Nutanix?",
  },
  {
    key: "kubernetes",
    gate: "Technical Proof",
    label: "On Kubernetes",
    letters: ["DC"],
    kind: "picklist",
    conversational: true,
    options: ["YES", "No", "In the pipeline"],
    askNext: "Are you running Kubernetes today, or is it planned?",
  },
  // ---- Business Proof --------------------------------------------------------
  {
    key: "budgetConfirmed",
    gate: "Business Proof",
    label: "Budget confirmed by economic buyer",
    letters: ["E", "M"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    askNext: "Has the budget for this been confirmed, and by whom?",
  },
  {
    key: "proposalRequested",
    gate: "Business Proof",
    label: "Customer has requested a proposal",
    letters: ["E"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    requiredValue: "YES",
    askNext: "Would you like us to put together a proposal?",
  },
  // ---- Proposal --------------------------------------------------------------
  {
    key: "procurementLegal",
    gate: "Proposal",
    label: "Procurement / legal contact",
    letters: ["P"],
    kind: "role",
    role: "Procurement/Legal",
    conversational: true,
    askNext: "Who from procurement or legal should we work with on the paperwork?",
  },
  {
    key: "wso2Selected",
    gate: "Proposal",
    label: "WSO2 selected",
    letters: ["CO"],
    kind: "picklist",
    conversational: true,
    options: YES_NO,
    requiredValue: "YES",
    askNext: "Where are you in the decision: has WSO2 been selected?",
  },
  // ---- Negotiation (not built in Salesforce yet) -----------------------------
  {
    key: "priceConfirmed",
    gate: "Negotiation",
    label: "Price confirmed",
    letters: ["P"],
    kind: "picklist",
    conversational: true,
    notInSalesforce: true,
    options: ["Yes", "No"],
    askNext: "Are we aligned on the final price?",
  },
  {
    key: "legalReview",
    gate: "Negotiation",
    label: "Legal review",
    letters: ["P"],
    kind: "picklist",
    conversational: true,
    notInSalesforce: true,
    options: ["Under Legal Review", "Completed Legal Review", "No Legal Review"],
    askNext: "Is the contract with your legal team, and when do you expect them to finish?",
  },
  // ---- In Procurement --------------------------------------------------------
  {
    key: "csOnboarding",
    gate: "In Procurement",
    label: "CS onboarding initiated",
    letters: [],
    kind: "salesforceOnly",
    conversational: false,
  },
  {
    key: "contractAdded",
    gate: "In Procurement",
    label: "Signed contract added",
    letters: ["P"],
    kind: "salesforceOnly",
    conversational: false,
  },
  {
    key: "wonReasons",
    gate: "In Procurement",
    label: "Won reasons",
    letters: [],
    kind: "multiPicklist",
    conversational: true,
    options: [
      "Superior product / feature fit",
      "Open source / no vendor lock-in",
      "TCO advantage",
      "Faster time to value",
      "Strong internal champion",
      "Existing WSO2 footprint",
      "Competitive pricing / commercial flexibility",
      "Other",
    ],
    askNext: "What made you choose WSO2 in the end?",
  },
  {
    key: "eulaVersion",
    gate: "In Procurement",
    label: "EULA version",
    letters: [],
    kind: "salesforceOnly",
    conversational: false,
  },
  {
    key: "autoRenewal",
    gate: "In Procurement",
    label: "Auto renewal",
    letters: ["P"],
    kind: "salesforceOnly",
    conversational: false,
  },
];

export const MOCK_GATES: GatesResponse = {
  version: 1,
  stages: [
    "Validate",
    "Qualify",
    "Technical Proof",
    "Business Proof",
    "Proposal",
    "Negotiation",
    "In Procurement",
    "Closed Won",
  ],
  letters: [...LETTERS],
  fields: FIELDS,
  missingFields: [],
};
