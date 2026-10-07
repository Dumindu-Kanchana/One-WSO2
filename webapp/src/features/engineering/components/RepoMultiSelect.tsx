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

import { Autocomplete, TextField } from "@wso2/oxygen-ui";
import { type JSX } from "react";
import { activeRepositories, useTrackedRepositories } from "../api/useTrackedRepositories";
import { productLabel } from "../utils/format";

interface RepoOption {
  id: number;
  label: string;
}

interface RepoMultiSelectProps {
  value: number[];
  onChange: (ids: number[]) => void;
}

// The product picker: a searchable multi-select of the active Products with
// removable chips. Labelled "Repositories", as on the standalone (CONTEXT.md,
// "Product"). An empty selection means every Product.
export default function RepoMultiSelect({ value, onChange }: RepoMultiSelectProps): JSX.Element {
  const { data, isLoading } = useTrackedRepositories();
  const options: RepoOption[] = activeRepositories(data).map((r) => ({
    id: r.id,
    label: productLabel(r.productName, r.repoName),
  }));
  const selected = options.filter((o) => value.includes(o.id));

  return (
    <Autocomplete
      multiple
      size="small"
      sx={{ minWidth: 280, flex: 1 }}
      options={options}
      loading={isLoading}
      value={selected}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, next) => onChange(next.map((o) => o.id))}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Repositories"
          placeholder={value.length === 0 ? "All repositories" : ""}
        />
      )}
    />
  );
}
