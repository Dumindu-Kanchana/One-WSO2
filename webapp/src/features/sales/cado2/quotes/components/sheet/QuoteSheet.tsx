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

import type { JSX } from "react";
import { Stack } from "@wso2/oxygen-ui";
import type { QuoteSheet as Sheet } from "@features/sales/cado2/quotes/sheet/sheetModel";
import CustomerBand from "./CustomerBand";
import DealFiguresSection from "./DealFiguresSection";
import DealSection from "./DealSection";
import ProductsSection from "./ProductsSection";
import ScheduleSection from "./ScheduleSection";
import { AddressesSection, JustificationSection, TermsSection } from "./TermsSections";

/**
 * Everything the quote says, read-only. The same sheet on the quote page
 * and the Review step. One view for WSO2 staff (2026-09-28); the customer's
 * copy is the generated order form (Document Generation, later).
 */
export default function QuoteSheet({ sheet, withCustomer = true }: { sheet: Sheet; withCustomer?: boolean }): JSX.Element {
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      {/* On the quote page the customer is in the page header instead. */}
      {withCustomer ? <CustomerBand sheet={sheet} /> : null}
      <DealSection sheet={sheet} />
      <ProductsSection sheet={sheet} />
      <DealFiguresSection sheet={sheet} />
      <ScheduleSection sheet={sheet} />
      <TermsSection sheet={sheet} />
      <AddressesSection sheet={sheet} />
      <JustificationSection sheet={sheet} />
    </Stack>
  );
}

