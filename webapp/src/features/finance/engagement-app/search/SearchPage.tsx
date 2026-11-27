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

import { useEffect, useRef, useState, type JSX } from "react";
import { Link as RouterLink, Navigate, useSearchParams } from "react-router";
import { Alert, Box, Divider, InputAdornment, Link, OutlinedInput, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useEngagementSearch } from "../api/useEngagementApi";
import { useEngagementAccess, useEngagementUserInfo } from "../api/useEngagementUserInfo";
import type { SearchGroup } from "../api/engagementTypes";
import { DelayedSkeleton } from "../components/EaSkeletons";
import EaPage from "../components/EaPage";
import { Empty, Failed, ListCard } from "../components/ListCard";
import { engagementPaths } from "../engagementPaths";
import { canSearch, engagementListLinks, itemPath, listPath, SEARCH_LABEL, SEARCH_MIN_CHARS } from "../model/searchLinks";
import SearchHit from "./SearchHit";

const LIMIT = 20;

/** `/search?q=`: every kind of record that matches, a card each, with a way into that kind's own list. */
export default function SearchPage(): JSX.Element {
  const access = useEngagementAccess();
  const queues = useEngagementUserInfo().data?.workQueues;
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const [text, setText] = useState(q);
  // The address can change under the field (a link, Back): follow it.
  const [shown, setShown] = useState(q);
  if (q !== shown) {
    setShown(q);
    setText(q);
  }
  const commit = useRef((next: string) => setParams(next ? { q: next } : {}, { replace: true }));
  useEffect(() => {
    commit.current = (next) => setParams(next ? { q: next } : {}, { replace: true });
  });
  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => commit.current(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, q]);

  const allowed = canSearch(access);
  const search = useEngagementSearch(q, LIMIT, allowed);
  if (!allowed) return <Navigate to={engagementPaths.home} replace />;

  const wanted = q.length >= SEARCH_MIN_CHARS;
  const groups: readonly SearchGroup[] = search.data?.groups ?? [];
  const failed = search.data?.failed ?? [];
  return (
    <EaPage title="Search Results" subtitle={wanted ? `Matches for "${q}" across the Engagement App.` : "Travels, invoices, per diem payments, engagements and allocations."}>
      <OutlinedInput
        size="small"
        value={text}
        autoFocus={!q}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search Engagement App"
        inputProps={{ "aria-label": "Search Engagement App" }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon size={15} />
          </InputAdornment>
        }
        sx={{ width: { xs: "100%", sm: 420 }, height: 36, fontSize: 13, mb: 2 }}
      />
      {!wanted ? (
        <ListCard>
          <Empty title="Type to Search" body={`Enter at least ${SEARCH_MIN_CHARS} characters.`} />
        </ListCard>
      ) : search.isError ? (
        <Failed what="the search results" error={search.error} onRetry={() => void search.refetch()} retrying={search.isFetching} />
      ) : search.isPending ? (
        <DelayedSkeleton minHeight={160}>
          <Stack spacing={2}>
            {[0, 1].map((i) => (
              <ListCard key={i}>
                <Skeleton variant="text" width={140} sx={{ fontSize: 15, mb: 0.5 }} />
                {[0, 1, 2].map((row) => (
                  <Box key={row} sx={{ px: 0.5, py: 1, borderTop: row ? 1 : 0, borderColor: "divider" }}>
                    <Skeleton variant="text" width={`${45 + ((i + row) % 3) * 12}%`} sx={{ fontSize: 13.5 }} />
                    <Skeleton variant="text" width="30%" sx={{ fontSize: 12 }} />
                  </Box>
                ))}
              </ListCard>
            ))}
          </Stack>
        </DelayedSkeleton>
      ) : (
        <Stack spacing={2} sx={{ opacity: search.isPlaceholderData ? 0.55 : 1, transition: "opacity 120ms" }} aria-busy={search.isPlaceholderData || undefined}>
          {failed.length ? (
            <Alert severity="warning">Couldn&apos;t search {failed.map((k) => SEARCH_LABEL[k]).join(", ")}. The rest of the results are below.</Alert>
          ) : null}
          {groups.length === 0 && !failed.length ? (
            <ListCard>
              <Empty title="No Matches" body={`Nothing matches "${q}". Try a shorter search, or the job number without TRV-.`} />
            </ListCard>
          ) : null}
          {groups.map((g) => (
            <ListCard key={g.kind}>
              <Box component="section" aria-label={SEARCH_LABEL[g.kind]}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 0.5 }}>
                  <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
                    {SEARCH_LABEL[g.kind]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {g.total}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {g.kind === "engagements" && engagementListLinks(q, access).length > 1 ? (
                    // Engagements live in one list per segment, so each gets its own link.
                    <Typography variant="body2" color="text.secondary" component="span">
                      View All in{" "}
                      {engagementListLinks(q, access).map((l, i) => (
                        <span key={l.label}>
                          {i > 0 ? ", " : null}
                          <Link component={RouterLink} to={l.to} underline="none" color="primary" sx={{ fontWeight: 600 }}>
                            {l.label}
                          </Link>
                        </span>
                      ))}
                    </Typography>
                  ) : (
                    <Link component={RouterLink} to={listPath(g.kind, q, access, queues)} underline="none" color="primary" variant="body2" sx={{ fontWeight: 600 }}>
                      View All in {SEARCH_LABEL[g.kind]}
                    </Link>
                  )}
                </Box>
                {g.items.map((item, i) => (
                  <Box key={item.id}>
                    {i > 0 ? <Divider /> : null}
                    <Link
                      component={RouterLink}
                      to={itemPath(g.kind, item, access, queues)}
                      underline="none"
                      color="inherit"
                      sx={{ display: "block", px: 0.5, py: 1, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <SearchHit kind={g.kind} item={item} />
                    </Link>
                  </Box>
                ))}
              </Box>
            </ListCard>
          ))}
        </Stack>
      )}
    </EaPage>
  );
}
