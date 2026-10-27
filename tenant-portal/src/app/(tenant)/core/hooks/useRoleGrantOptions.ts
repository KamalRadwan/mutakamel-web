"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchAssignmentOptions, type AssignmentChoice } from "../contracts/assignment-options-contract";

export function useRoleGrantOptions(userId: string, enabled: boolean) {
  const lang = useLanguage();
  const key = `${userId}:${lang}`;
  const [request, setRequest] = useState({ key, query: "", page: 1 });
  const { query, page } = request.key === key ? request : { query: "", page: 1 };
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState("");
  const [data, setData] = useState<{ key: string; choices: AssignmentChoice[]; labels: Record<string, string> }>({
    key: "", choices: [], labels: {},
  });
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasMore, setHasMore] = useState(false);
  const requestKey = `${key}:${query}:${page}:${reloadToken}`;

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || !enabled) return;
      setIsLoading(true);
      setError(null);
      fetchAssignmentOptions(userId, query, page, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          const nextLabels = Object.fromEntries(result.labels.map((row) => [
            `${row.kind}:${row.id}`, localizedValue(row.nameAr, row.nameEn, lang),
          ]));
          for (const row of result.choices) {
            nextLabels[`role:${row.roleId}`] = localizedValue(row.roleNameAr, row.roleNameEn, lang);
            nextLabels[`branch:${row.branchId}`] = row.branchName;
          }
          setData((current) => ({
            key,
            choices: page === 1 || current.key !== key ? result.choices : [...current.choices, ...result.choices].filter(
              (row, index, rows) => rows.findIndex((item) => item.branchId === row.branchId && item.roleId === row.roleId) === index,
            ),
            labels: { ...(current.key === key ? current.labels : {}), ...nextLabels },
          }));
          setLoaded(requestKey);
          setHasMore(result.hasMore);
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(normalizeApiError(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, key, lang, page, query, reloadToken, requestKey, userId]);

  const search = useCallback((next: string) => setRequest({ key, query: next, page: 1 }), [key]);
  const retry = useCallback(() => setReloadToken((token) => token + 1), []);
  const labelFor = (kind: "role" | "branch" | "company", id: string | null | undefined) =>
    data.key === key && id ? data.labels[`${kind}:${id}`] : undefined;
  const isReady = enabled && loaded === requestKey && !isLoading && !error;

  return {
    choices: isReady ? data.choices : [],
    isLoading: enabled && (isLoading || loaded !== requestKey && !error),
    error, retry, search, hasMore,
    loadMore: () => { if (isReady && hasMore) setRequest({ key, query, page: page + 1 }); },
    labelFor,
    isReady,
    options: (isReady ? data.choices : []).map((row) => ({
      value: `${row.branchId}:${row.roleId}`,
      label: `${localizedValue(row.roleNameAr, row.roleNameEn, lang)} — ${row.branchName}`,
    })),
  };
}
