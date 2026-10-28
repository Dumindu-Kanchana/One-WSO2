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

export type OkrStatus = "OPEN" | "COMPLETED";

export const OKR_MAX_KEY_RESULTS = 5;
export const OKR_OBJECTIVE_MAX_LENGTH = 300;
export const OKR_KEY_RESULT_MAX_LENGTH = 200;

/** An objective set for one person by an OKR manager, with a due date. */
export interface Okr {
  okrId: number;
  ownerEmail: string;
  ownerName?: string;
  ownerLeadEmail?: string;
  objective: string;
  keyResults: string[];
  /** YYYY-MM-DD */
  dueDate: string;
  status: OkrStatus;
  completedBy?: string;
  completedOn?: string;
  createdBy: string;
  updatedBy: string;
}

export interface OkrCreate {
  ownerEmail: string;
  objective: string;
  keyResults: string[];
  dueDate: string;
}

export interface OkrUpdate {
  objective?: string;
  keyResults?: string[];
  dueDate?: string;
  status?: OkrStatus;
}

export interface OkrAccess {
  canManage: boolean;
}
