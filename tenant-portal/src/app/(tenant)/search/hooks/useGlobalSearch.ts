"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { readCorePage, readCrmBody } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CORE_PARTIES_PATH,
  SEARCH_PREVIEW_LIMIT,
  SEARCH_RESPONSE_LIMIT_BYTES,
  SEARCH_SOURCES,
  SEARCH_SOURCE_IDS,
  buildCrmSearchPath,
  buildPartiesSearchQuery,
  isSearchableTerm,
  normalizeSearchTerm,
  parseCoreSearchPage,
  parseCrmSearchPage,
  type CrmSearchSourceId,
  type SearchSourceId,
  type SearchSourcePage,
} from "../search-contract";

/**
 * One family's outcome. Six cases, not two, because "you may not see this",
 * "nothing here is searchable until you pick a branch" and "the request failed"
 * are three different sentences and only the last one gets a retry —
 * docs/design/states.md.
 */
export type SearchSourceState =
  /** No route permission. The section is not rendered at all. */
  | { kind: "unauthorized" }
  /** A CRM family with no branch resolved: `branchId` is required, not optional. */
  | { kind: "needsBranch" }
  | { kind: "loading" }
  | { kind: "ready"; page: SearchSourcePage }
  /** The server refused this family. S7 — never an empty state. */
  | { kind: "denied" }
  | { kind: "failed"; error: NormalizedApiError };

export interface GlobalSearchState {
  /** What the input holds right now. */
  draft: string;
  setDraft: (value: string) => void;
  /** The term the current results belong to; "" before the first search. */
  term: string;
  submit: () => void;
  isSearching: boolean;
  /** True once a term has been submitted, so "no results" is distinguishable. */
  hasSearched: boolean;
  results: Record<SearchSourceId, SearchSourceState>;
  /** Sources the actor may see at all, in the order the screen renders them. */
  visibleSourceIds: SearchSourceId[];
  totalMatches: number;
  branchId: string | null;
  branchIds: string[];
  selectBranch: (branchId: string) => void;
  retry: () => void;
}

const CRM_READ_SCOPES = ["own", "team", "all"] as const;

/**
 * Route admission from `/auth/me` — S6. This is the same comparison
 * `canAccessCrmRoute` makes, applied per SOURCE rather than per route: a global
 * search fans out to four families and each is admitted on its own grant, so
 * one missing permission must remove one section rather than the screen.
 *
 * Advisory only. The server re-decides, and a 403 renders `denied` above.
 */
function hasSourcePermission(
  permissions: readonly string[],
  permission: string,
  acceptsScopedPermission: boolean,
): boolean {
  return permissions.some(
    (held) =>
      held === permission ||
      (acceptsScopedPermission &&
        CRM_READ_SCOPES.some((scope) => held === `${permission}.${scope}`)),
  );
}

export async function fetchPartiesSearchPage(
  term: string,
  page: number,
  limit: number,
  signal: AbortSignal,
): Promise<SearchSourcePage> {
  return parseCoreSearchPage(
    await readCorePage(CORE_PARTIES_PATH, buildPartiesSearchQuery(term, page, limit), {
      signal,
      cache: "no-store",
      maxResponseBytes: SEARCH_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function fetchCrmSearchPage(
  source: CrmSearchSourceId,
  branchId: string,
  term: string,
  page: number,
  limit: number,
  signal: AbortSignal,
): Promise<SearchSourcePage> {
  return parseCrmSearchPage(
    source,
    await readCrmBody(buildCrmSearchPath(source, branchId, term, page, limit), {
      signal,
      cache: "no-store",
      maxResponseBytes: SEARCH_RESPONSE_LIMIT_BYTES,
    }),
  );
}

function failureState(reason: unknown): SearchSourceState {
  const error = normalizeApiError(reason);
  // 403 is "this is not yours", not "there is nothing here" — S7. It is a
  // per-family answer, so it removes that family's rows and nothing else.
  return error.status === 403 ? { kind: "denied" } : { kind: "failed", error };
}

const UNAUTHORIZED: SearchSourceState = { kind: "unauthorized" };

/** One completed fan-out, tagged with the request it answers. */
interface SearchOutcome {
  key: string;
  results: Record<SearchSourceId, SearchSourceState>;
}

function initialStates(
  permissions: readonly string[],
): Record<SearchSourceId, SearchSourceState> {
  return Object.fromEntries(
    SEARCH_SOURCE_IDS.map((id) => {
      const source = SEARCH_SOURCES[id];
      const permitted = hasSourcePermission(
        permissions,
        source.permission,
        source.acceptsScopedPermission,
      );
      return [id, permitted ? { kind: "loading" } : UNAUTHORIZED];
    }),
  ) as Record<SearchSourceId, SearchSourceState>;
}

/**
 * The global record search — MASTER-PLAN 13.21.
 *
 * Every family is fetched under `allSettled` and degrades on its own. Under
 * `Promise.all` a single `403` on one module would blank results the other
 * three returned perfectly well, which is the exact failure
 * docs/design/states.md#partial-failure-needs-promiseallsettled names.
 */
export function useGlobalSearch(initialTerm: string): GlobalSearchState {
  const { user } = useTenantAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);

  const [draft, setDraft] = useState(initialTerm);
  const [term, setTerm] = useState(() => normalizeSearchTerm(initialTerm));
  const [reloadToken, setReloadToken] = useState(0);
  // The ONLY state the effect writes, and it is written after the await rather
  // than synchronously in the effect body. Everything else — loading, the idle
  // state, and staleness — is derived from whether the stored outcome's key
  // still matches the current request, which is also what makes a late reply
  // from a superseded request harmless without an epoch counter.
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);

  const visibleSourceIds = useMemo(
    () =>
      SEARCH_SOURCE_IDS.filter((id) =>
        hasSourcePermission(
          permissions,
          SEARCH_SOURCES[id].permission,
          SEARCH_SOURCES[id].acceptsScopedPermission,
        ),
      ),
    [permissions],
  );

  const requestKey = [
    term,
    branchId ?? "",
    reloadToken,
    visibleSourceIds.join("+"),
  ].join("::");

  const submit = useCallback(() => {
    setTerm(normalizeSearchTerm(draft));
    setReloadToken((token) => token + 1);
  }, [draft]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!isSearchableTerm(term)) return;

    const controller = new AbortController();
    void (async () => {
      const requested = visibleSourceIds.filter(
        (id) => SEARCH_SOURCES[id].app === "core" || branchId !== null,
      );
      const settled = await Promise.allSettled(
        requested.map((id) =>
          id === "parties"
            ? fetchPartiesSearchPage(term, 1, SEARCH_PREVIEW_LIMIT, controller.signal)
            : fetchCrmSearchPage(
                id,
                branchId as string,
                term,
                1,
                SEARCH_PREVIEW_LIMIT,
                controller.signal,
              ),
        ),
      );
      if (controller.signal.aborted) return;

      const next = initialStates(permissions);
      for (const id of visibleSourceIds) {
        const index = requested.indexOf(id);
        if (index < 0) {
          next[id] = { kind: "needsBranch" };
          continue;
        }
        const settledSource = settled[index];
        next[id] =
          settledSource.status === "fulfilled"
            ? { kind: "ready", page: settledSource.value }
            : failureState(settledSource.reason);
      }
      setOutcome({ key: requestKey, results: next });
    })();

    return () => controller.abort();
  }, [requestKey, term, branchId, permissions, visibleSourceIds]);

  const isCurrent = outcome !== null && outcome.key === requestKey;
  const results = useMemo(
    () => (isCurrent ? (outcome as SearchOutcome).results : initialStates(permissions)),
    [isCurrent, outcome, permissions],
  );

  const totalMatches = useMemo(
    () =>
      visibleSourceIds.reduce((sum, id) => {
        const state = results[id];
        return state.kind === "ready" ? sum + state.page.total : sum;
      }, 0),
    [results, visibleSourceIds],
  );

  return {
    draft,
    setDraft,
    term,
    submit,
    isSearching: isSearchableTerm(term) && !isCurrent,
    hasSearched: isSearchableTerm(term),
    results,
    visibleSourceIds,
    totalMatches,
    branchId,
    branchIds,
    selectBranch,
    retry,
  };
}
