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

// UMT is an app inside the Engineering perspective, so every UMT route sits
// under the Engineering path. findPerspectiveByPath matches with a bare
// `pathname.startsWith`, and that prefix is what gives these screens the
// Engineering rail.

/** Root of every UMT route — the UMT dashboard. */
export const UMT_PATH = "/engineering/umt";

export const umtPaths = {
  updates: `${UMT_PATH}/updates`,
  update: (id: string | number) => `${UMT_PATH}/updates/${id}`,
  products: `${UMT_PATH}/products`,
  releaseChunks: `${UMT_PATH}/release-chunks`,
  newReleaseChunk: `${UMT_PATH}/release-chunks/new`,
  statistics: `${UMT_PATH}/statistics`,
} as const;
