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

import type { FormTemplate } from "./leadership360Types";

// A goal from last cycle. The status stays empty until the employee picks
// one; sharing needs every goal to have one.
export interface SelfReviewGoal {
  title: string;
  status: string | null;
}

// Answers keyed by question id: text for TEXT questions, a goal list for GOALS.
export type SelfReviewAnswers = Record<string, string | SelfReviewGoal[] | null>;

// GET /par-cycles/{id}/employees/{email}/self-review. A lead or PAR admin
// gets empty answers until the employee shares.
export interface SelfReview {
  template: FormTemplate;
  answers: SelfReviewAnswers;
  employeeStatus: string;
}
