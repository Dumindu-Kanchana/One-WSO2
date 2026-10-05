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

import { Box, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import { type JSX, type SyntheticEvent } from "react";
import { useSearchParams } from "react-router";
import ComplianceReferencesPage from "./ComplianceReferencesPage";
import CustomersPage from "./CustomersPage";
import DeploymentTypesPage from "./DeploymentTypesPage";
import PlatformsPage from "./PlatformsPage";
import ProductsPage from "./ProductsPage";
import RiskCategoriesPage from "./RiskCategoriesPage";
import RiskScoresPage from "./RiskScoresPage";
import RiskTeamsPage from "./RiskTeamsPage";

const SUB_TABS = [
  "teams",
  "categories",
  "compliance",
  "scores",
  "platforms",
  "customers",
  "products",
  "deployment-types",
] as const;
type SubTab = (typeof SUB_TABS)[number];

const isSubTab = (v: string | null): v is SubTab => SUB_TABS.some((t) => t === v);

// One route (/admin/risk-hub) with the sub-screens switched by tab, rather
// than separate nav items — the design consolidated Users / Manage Risk
// Hub / Manage Audit Hub to three top-level Admin Console sections, with the
// Risk Hub's own reference-data screens living inside this one as tabs.
//
// The tab lives in ?tab= so it can be linked to: the "request a customer"
// email sends admins to /admin/risk-hub?tab=customers.
export default function ManageRiskHubPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: SubTab = isSubTab(requested) ? requested : "teams";

  const handleChange = (_e: SyntheticEvent, value: SubTab) => setSearchParams({ tab: value }, { replace: true });

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        Manage Risk Hub
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reference data the Risk Hub's dropdowns are built from: teams, categories, compliance references, the
        risk-scoring matrix, and the platforms, customers, products and deployment types the Aggregated and Managed
        Services register templates use.
      </Typography>

      <Tabs value={tab} onChange={handleChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label="Risk Teams" value="teams" />
        <Tab label="Risk Categories" value="categories" />
        <Tab label="Compliance References" value="compliance" />
        <Tab label="Risk Scores" value="scores" />
        <Tab label="Platforms" value="platforms" />
        <Tab label="Customers" value="customers" />
        <Tab label="Products" value="products" />
        <Tab label="Deployment Types" value="deployment-types" />
      </Tabs>

      {tab === "teams" && <RiskTeamsPage />}
      {tab === "categories" && <RiskCategoriesPage />}
      {tab === "compliance" && <ComplianceReferencesPage />}
      {tab === "scores" && <RiskScoresPage />}
      {tab === "platforms" && <PlatformsPage />}
      {tab === "customers" && <CustomersPage />}
      {tab === "products" && <ProductsPage />}
      {tab === "deployment-types" && <DeploymentTypesPage />}
    </Box>
  );
}
