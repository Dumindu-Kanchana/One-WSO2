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

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { draft, fullPartnerQuote } from "@features/sales/cado2/quotes/testing/fixtures";
import { sheetFromVersion } from "@features/sales/cado2/quotes/sheet/sheetModel";
import QuoteSheet from "./QuoteSheet";
import DealFiguresSection from "./DealFiguresSection";
import type { QuoteSheet as Sheet, SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";

const sheet = sheetFromVersion(fullPartnerQuote);

describe("QuoteSheet", () => {
  it("puts the customer, the opportunity and the partner up front, the deal facts in Deal, and each contact under its address", () => {
    render(<QuoteSheet sheet={sheet} />);
    const band = screen.getByRole("region", { name: "Customer" });

    expect(within(band).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(band).getByText("Acme APIM renewal")).toBeInTheDocument();
    expect(within(band).getByText("Acme Reseller")).toBeInTheDocument();
    // No chips under the name: the deal type and region are facts in the Deal section.
    expect(within(band).queryByText("Partner deal")).toBeNull();
    expect(within(band).queryByText("Renewal of 1 opportunity")).toBeNull();
    const deal = screen.getByRole("region", { name: "Deal" });
    expect(deal).toHaveTextContent("Deal typePartner deal");
    expect(deal).toHaveTextContent("Sales regionAPAC");
    expect(deal).toHaveTextContent("Sub-regionSouth Asia");

    // Two contacts, both on the order form; no primary contact.
    expect(within(band).queryByLabelText("Primary contact")).toBeNull();
    // The contacts sit with the addresses, as in the order form's section 01.
    expect(within(band).queryByLabelText("Billing contact")).toBeNull();
    const billTo = screen.getByLabelText("Bill to");
    expect(within(billTo).getByLabelText("Billing contact")).toHaveTextContent("typed in");
    const security = within(screen.getByLabelText("Ship to")).getByLabelText("Security contact");
    expect(within(security).getByText("Marco Ruiz")).toBeInTheDocument();
    expect(within(security).getByRole("link", { name: /marco@acme.example/ })).toHaveAttribute("href", "mailto:marco@acme.example");
    expect(security).not.toHaveTextContent("typed in");
  });

  it("prints the ship-to address in full when it is the bill-to address, and says so", () => {
    render(<QuoteSheet sheet={{ ...sheet, shipTo: null, shipToSameAsBillTo: true }} />);
    const shipTo = screen.getByLabelText("Ship to");
    expect(within(shipTo).getByText("Same as bill to")).toBeInTheDocument();
    expect(within(shipTo).getByText(sheet.billTo!.companyName)).toBeInTheDocument();
    for (const line of sheet.billTo!.lines) expect(within(shipTo).getByText(line)).toBeInTheDocument();
  });

  it("shows every submitted field", () => {
    render(<QuoteSheet sheet={sheet} />);
    for (const text of [
      "WSO2, LLC.",
      "787 Castro Street, Mountain View, CA, USA",
      "1 Oct 2026 – 30 Sept 2027",
      "Annually in advance",
      "Acme renewal FY26",
      "Net 45",
      "PO-4471",
      "Custom SLA credits",
      "WSO2 standard terms",
      "Acme Reseller Ltd",
      "Tax ID GB123",
      "Suite 400",
      "Strategic logo in the region",
      "2026-09-M9",
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
    const products = screen.getByRole("table", { name: "Products" });
    expect(within(products).getByText("WSO2 Gateway")).toBeInTheDocument();
    expect(within(products).getByText("Subscription")).toBeInTheDocument();
    expect(within(products).getByText("Gateways")).toBeInTheDocument();
    // A one-year quote has no yearly schedule.
    expect(screen.queryByRole("table", { name: "Yearly schedule" })).toBeNull();
  });

  it("shows one view with the internal details: price book, pricing rules, justification", () => {
    render(<QuoteSheet sheet={{ ...sheet, pricebookName: "FY26 USD" }} />);
    expect(screen.queryByRole("group", { name: "Quote view" })).toBeNull();
    // The quote's price book once, in the Deal section; not on every line.
    expect(screen.getByText("FY26 USD")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Products" })).queryByText(/FY26 USD/)).toBeNull();
    expect(screen.getByText("Strategic logo in the region")).toBeInTheDocument();
    expect(screen.getByText("2026-09-M9")).toBeInTheDocument();
  });

  it("marks gaps on a draft", () => {
    render(<QuoteSheet sheet={sheetFromVersion(draft)} />);
    expect(screen.getAllByText("Not set yet").length).toBeGreaterThan(3);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getByText("Appears once the quote can be priced")).toBeInTheDocument();
  });
});

// A 3-year quote: two subscriptions, support and a one-time service.
const line = (number: number, productName: string, category: SheetLine["category"], tcv: string, arr: string): SheetLine => ({
  number, productName, productCode: null, productDescription: null, pricebookName: "FY26 USD", category, categoryByRep: false, quantity: "1", unitOfMeasure: null, unitPrice: "1",
  discountPercent: "0", startDate: "2027-01-01", endDate: "2029-12-31", annualList: null, annualNet: null, arr, acv: null, tcv, commission: "0.00",
  schedule: [1, 2, 3].map((y) => ({ yearNumber: y, periodStart: "", periodEnd: "", yearFraction: "1.0000", gross: "1.00", discount: "0.00", net: "1.00", billing: "1.00" })),
});
const threeYears: Sheet = {
  ...sheet,
  termMode: "MULTI_YEAR",
  termYears: 3,
  endDate: "2029-12-31",
  lines: [
    line(1, "Gateway", "SUBSCRIPTION", "19440.00", "6480.00"),
    line(2, "API Portal", "SUBSCRIPTION", "14400.00", "4800.00"),
    line(3, "Enterprise Support", "SUPPORT", "75000.00", "25000.00"),
    line(4, "Onboarding", "PROFESSIONAL_SERVICE", "10700.00", "0.00"),
  ],
  years: [
    { yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-12-31", net: "46980.00", billing: "46980.00" },
    { yearNumber: 2, periodStart: "2028-01-01", periodEnd: "2028-12-31", net: "36280.00", billing: "36280.00" },
    { yearNumber: 3, periodStart: "2029-01-01", periodEnd: "2029-12-31", net: "36280.00", billing: "36280.00" },
  ],
  totals: { arr: "36280.00", acv: "39846.67", tcv: "119540.00", payableNow: "46980.00" },
};

describe("Order form", () => {
  it("groups the lines by category, each with its own subtotal, then the total order value", () => {
    render(<QuoteSheet sheet={threeYears} />);
    const table = within(screen.getByRole("table", { name: "Products" }));
    const rows = table.getAllByRole("row").map((r) => r.textContent);
    const at = (text: string) => rows.findIndex((r) => r?.includes(text));
    expect(at("Subscription")).toBeLessThan(at("Gateway"));
    expect(at("API Portal")).toBeLessThan(at("Subscription subtotal"));
    expect(at("Subscription subtotal")).toBeLessThan(at("Enterprise Support"));
    expect(at("Enterprise Support")).toBeLessThan(at("Support subtotal"));
    expect(at("Support subtotal")).toBeLessThan(at("Onboarding"));
    expect(at("Onboarding")).toBeLessThan(at("Professional Services subtotal"));
    expect(rows[at("Subscription subtotal")]).toContain("33,840.00");
    expect(rows[at("Support subtotal")]).toContain("75,000.00");
    expect(rows[at("Professional Services subtotal")]).toContain("10,700.00");
    expect(rows.some((r) => r?.includes("Support and services"))).toBe(false);
    expect(rows[at("Total order value")]).toContain("119,540.00");
  });

  it("shows a line's product description under its name", () => {
    const described = { ...threeYears.lines[0], productDescription: "Based on the number of gateways." };
    render(<QuoteSheet sheet={{ ...threeYears, lines: [described, ...threeYears.lines.slice(1)] }} />);
    const table = within(screen.getByRole("table", { name: "Products" }));
    const cell = table.getByText(described.productName).closest("td")!;
    expect(within(cell).getByText("Based on the number of gateways.")).toBeInTheDocument();
  });

  it("shows the yearly schedule for a multi-year quote, with each year's opportunity", () => {
    render(<QuoteSheet sheet={threeYears} />);
    const schedule = within(screen.getByRole("table", { name: "Yearly schedule" }));
    expect(schedule.getByText("This quote's opportunity")).toBeInTheDocument();
    expect(schedule.getAllByText("Own opportunity, created later")).toHaveLength(2);
    expect(schedule.getByText("1. Gateway")).toBeInTheDocument();
  });
});

describe("Partner commission", () => {
  // 15% of every line of the 3-year quote: 2,916 + 2,160 + 11,250 + 1,605.
  const withCommission = (l: SheetLine, c: string): SheetLine => ({ ...l, commission: c });
  const partner: Sheet = {
    ...threeYears,
    partnerCommissionPercent: "15",
    lines: [
      withCommission(threeYears.lines[0], "2916.00"),
      withCommission(threeYears.lines[1], "2160.00"),
      withCommission(threeYears.lines[2], "11250.00"),
      withCommission(threeYears.lines[3], "1605.00"),
    ],
    totals: { ...threeYears.totals!, payableNow: "39933.00", partnerCommission: "17931.00", netOrderValue: "101609.00" },
  };

  it("adds the commission and the net order value under the total order value", () => {
    render(<QuoteSheet sheet={partner} />);
    const rows = within(screen.getByRole("table", { name: "Products" })).getAllByRole("row").map((r) => r.textContent ?? "");
    const at = (text: string) => rows.findIndex((r) => r.includes(text));
    expect(rows[at("Total order value")]).toContain("119,540.00");
    expect(rows[at("Partner commission (15%)")]).toContain("− 17,931.00");
    expect(rows[at("Net order value")]).toContain("101,609.00");
    expect(at("Total order value")).toBeLessThan(at("Net order value"));
  });

  it("explains the commission and the net value in the deal figures", () => {
    render(<DealFiguresSection sheet={partner} />);
    expect(within(screen.getByLabelText("Partner commission")).getByText("USD 17,931.00")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Net order value")).getByText(/TCV 119,540.00 − commission 17,931.00/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("First invoice")).getByText(/net of the partner's commission/)).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Figures by product" })).getByText("Commission")).toBeInTheDocument();
  });

  it("shows the schedule's billing net of commission", () => {
    render(<QuoteSheet sheet={{ ...partner, years: partner.years.map((y) => ({ ...y, netBilling: "1.00" })) }} />);
    expect(within(screen.getByRole("table", { name: "Yearly schedule" })).getByText("Billed, net of commission")).toBeInTheDocument();
  });

  it("shows no commission rows on a direct deal", () => {
    render(<QuoteSheet sheet={{ ...threeYears, dealType: "DIRECT", partnerCommissionPercent: null }} />);
    expect(screen.queryByText(/Partner commission/)).toBeNull();
  });
});

describe("DealFiguresSection", () => {
  it("shows how ARR, TCV and ACV are worked out, and each product's share", () => {
    render(<DealFiguresSection sheet={threeYears} />);
    const arr = within(screen.getByLabelText("ARR · annual recurring revenue"));
    expect(arr.getByText("USD 36,280.00")).toBeInTheDocument();
    expect(arr.getByText(/Gateway 6,480.00 \+ API Portal 4,800.00 \+ Enterprise Support 25,000.00/)).toBeInTheDocument();
    expect(arr.getByText(/Left out, one-time: Onboarding/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("TCV · total contract value")).getByText(/Year 1 46,980.00 \+ Year 2 36,280.00 \+ Year 3 36,280.00/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("ACV · average per contract year")).getByText("TCV ÷ 3 contract years")).toBeInTheDocument();
    expect(within(screen.getByLabelText("First invoice")).getByText("Year 1, billed annually in advance")).toBeInTheDocument();
    const byProduct = within(screen.getByRole("table", { name: "Figures by product" }));
    expect(byProduct.getByText("One-time")).toBeInTheDocument();
    expect(byProduct.getByText("19,440.00")).toBeInTheDocument();
  });

  it("shows ARR and ACV as not applicable on a services-only quote", () => {
    const services: Sheet = {
      ...sheet,
      recurring: false,
      lines: [line(1, "Onboarding", "PROFESSIONAL_SERVICE", "720.00", "0.00")],
      years: [{ yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-01-01", net: "720.00", billing: "720.00" }],
      totals: { arr: null, acv: null, tcv: "720.00", payableNow: "720.00" },
    };
    render(<DealFiguresSection sheet={services} />);
    expect(within(screen.getByLabelText("ARR · annual recurring revenue")).getByText("Not applicable")).toBeInTheDocument();
    expect(within(screen.getByLabelText("ACV · average per contract year")).getByText("Not applicable")).toBeInTheDocument();
    expect(within(screen.getByLabelText("First invoice")).getByText("Everything, billed once")).toBeInTheDocument();
  });
});
