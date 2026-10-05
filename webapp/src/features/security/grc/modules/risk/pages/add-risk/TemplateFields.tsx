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

import { useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Box, ComplexSelect, FormHelperText, Link, Stack, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { LookupOption, RegisterTemplate } from "../../api/riskApi";
import FieldLabel from "./FieldLabel";
import PillMultiSelect from "./PillMultiSelect";
import RequestCustomerDialog from "./RequestCustomerDialog";
import { ENVIRONMENTS } from "./templates";
import type { AddRiskFormValues } from "./types";

export interface TemplateLookups {
  platforms: LookupOption[];
  customers: LookupOption[];
  products: LookupOption[];
  deploymentTypes: LookupOption[];
}

interface TemplateFieldsProps {
  template: RegisterTemplate;
  lookups: TemplateLookups;
}

// The fields a register's template adds to Basic Information
// (RISK_MODULE_DESIGN.md §14). Renders nothing for the Standard template, whose
// fields are the original ones.
//
//   Aggregated        → Platform
//   Managed Services  → Customer Name, Deployment Type, Product, Environment
//
// Every one is required. The Source Register is what brings these up, so
// there is no way to pick a template here.
export default function TemplateFields({ template, lookups }: TemplateFieldsProps): JSX.Element | null {
  const { control, clearErrors } = useFormContext<AddRiskFormValues>();
  const platforms = useWatch({ control, name: "platforms" });
  const products = useWatch({ control, name: "products" });
  const environments = useWatch({ control, name: "environments" });
  const [requesting, setRequesting] = useState(false);

  if (template === "STANDARD") return null;

  return (
    <Stack gap={3}>
      {template === "AGGREGATED" && (
        <Controller
          name="platforms"
          control={control}
          render={({ field, fieldState }) => (
            <PillMultiSelect
              label="Platform"
              required
              ariaLabel="Platforms"
              options={lookups.platforms.map((p) => ({ value: p.id, label: p.name }))}
              value={platforms}
              onChange={(next) => {
                field.onChange(next);
                if (next.length > 0) clearErrors("platforms");
              }}
              error={fieldState.error?.message}
              emptyMessage="No platforms have been added yet. Ask a platform admin to add them."
            />
          )}
        />
      )}

      {template === "MANAGED_SERVICES" && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              alignItems: "flex-start",
            }}
          >
            <Controller
              name="customer"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <FieldLabel required>Customer Name</FieldLabel>
                  <ComplexSelect
                    {...field}
                    fullWidth
                    error={!!fieldState.error}
                    displayEmpty
                    onChange={(e) => {
                      field.onChange(e);
                      if (e.target.value) clearErrors("customer");
                    }}
                  >
                    <ComplexSelect.MenuItem value="" disabled sx={{ display: "none" }}>
                      Select a customer
                    </ComplexSelect.MenuItem>
                    {lookups.customers.map((c) => (
                      <ComplexSelect.MenuItem key={c.id} value={c.id}>
                        {c.name}
                        {c.code ? ` (${c.code})` : ""}
                      </ComplexSelect.MenuItem>
                    ))}
                  </ComplexSelect>
                  {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                    Can't find the customer?{" "}
                    <Link component="button" type="button" variant="caption" onClick={() => setRequesting(true)}>
                      Request it
                    </Link>
                    . Its code goes into the risk code and can't be changed after the risk is created.
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="deploymentType"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <FieldLabel required>Deployment Type</FieldLabel>
                  <ComplexSelect
                    {...field}
                    fullWidth
                    error={!!fieldState.error}
                    displayEmpty
                    onChange={(e) => {
                      field.onChange(e);
                      if (e.target.value) clearErrors("deploymentType");
                    }}
                  >
                    <ComplexSelect.MenuItem value="" disabled sx={{ display: "none" }}>
                      Select a deployment type
                    </ComplexSelect.MenuItem>
                    {lookups.deploymentTypes.map((d) => (
                      <ComplexSelect.MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </ComplexSelect.MenuItem>
                    ))}
                  </ComplexSelect>
                  {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
                </Box>
              )}
            />
          </Box>

          <Controller
            name="products"
            control={control}
            render={({ field, fieldState }) => (
              <PillMultiSelect
                label="Product"
                required
                ariaLabel="Products"
                options={lookups.products.map((p) => ({ value: p.id, label: p.name }))}
                value={products}
                onChange={(next) => {
                  field.onChange(next);
                  if (next.length > 0) clearErrors("products");
                }}
                error={fieldState.error?.message}
                emptyMessage="No products have been added yet. Ask a platform admin to add them."
              />
            )}
          />

          <Controller
            name="environments"
            control={control}
            render={({ field, fieldState }) => (
              <PillMultiSelect
                label="Environment"
                required
                ariaLabel="Environments"
                options={ENVIRONMENTS}
                value={environments}
                onChange={(next) => {
                  field.onChange(next);
                  if (next.length > 0) clearErrors("environments");
                }}
                error={fieldState.error?.message}
              />
            )}
          />

          <RequestCustomerDialog open={requesting} onClose={() => setRequesting(false)} />
        </>
      )}
    </Stack>
  );
}
