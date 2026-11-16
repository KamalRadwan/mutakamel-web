"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { fetchTemplateVersion } from "../../template-lifecycle-api";
import type { TemplateVersion } from "../../template-lifecycle-contract";
import type { TemplateRecoveryAuthority } from "../../template-recovery-policy";

export interface TemplateVersionComparisonInput {
  templateId: string;
  dataSourceKey: string;
  leftVersionId: string;
  rightVersionId: string;
  authority: TemplateRecoveryAuthority;
  blocked: boolean;
}
type VersionComparisonResult = { state: "loading" | "failed" | "denied" | "unavailable" } |
  { state: "ready"; left: TemplateVersion; right: TemplateVersion; sameContentChecksum: boolean };

/** Immutable metadata reads only. The current version DTO does not carry an authored document. */
export function useTemplateVersionComparison(input: TemplateVersionComparisonInput) {
  const { templateId, dataSourceKey, leftVersionId, rightVersionId, authority, blocked } = input;
  const requestKey = JSON.stringify([authority.key, authority.epoch, templateId, dataSourceKey, leftVersionId, rightVersionId]);
  const latest = useRef({ requestKey, authority, blocked });
  useLayoutEffect(() => { latest.current = { requestKey, authority, blocked }; });
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState<{ requestKey: string; attempt: number; result: VersionComparisonResult } | null>(null);
  const available = authority.readable && !blocked && [templateId, leftVersionId, rightVersionId].every(isUUIDv7);
  const open = available && openFor === requestKey;
  useLayoutEffect(() => {
    if (available && (openFor === null || openFor === requestKey)) return;
    queueMicrotask(() => { setOpenFor(null); setReview(null); });
  }, [available, openFor, requestKey]);
  useEffect(() => {
    if (!open || !latest.current.authority.current()) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && latest.current.requestKey === requestKey &&
      !latest.current.blocked && latest.current.authority.readable && latest.current.authority.current();
    const left = fetchTemplateVersion(templateId, leftVersionId, controller.signal);
    const right = leftVersionId === rightVersionId ? left : fetchTemplateVersion(templateId, rightVersionId, controller.signal);
    void Promise.all([left, right]).then(([before, after]) => {
      if (!current()) return;
      const coherent = before.id === leftVersionId && after.id === rightVersionId &&
        before.dataSourceKey === dataSourceKey && after.dataSourceKey === dataSourceKey;
      const result: VersionComparisonResult = coherent ? { state: "ready", left: before, right: after,
        sameContentChecksum: before.templateContentChecksum === after.templateContentChecksum } : { state: "unavailable" };
      setReview({ requestKey, attempt, result });
    }, cause => {
      if (!current()) return;
      const { status } = normalizeApiError(cause);
      setReview({ requestKey, attempt, result: { state: status === 403 ? "denied" : [401, 404].includes(status) ? "unavailable" : "failed" } });
    });
    return () => controller.abort();
  }, [open, requestKey, attempt, templateId, dataSourceKey, leftVersionId, rightVersionId]);
  const admitted = () => latest.current.requestKey === requestKey && latest.current.authority.readable &&
    !latest.current.blocked && latest.current.authority.current();
  const result: VersionComparisonResult = !available ? { state: "unavailable" } :
    review?.requestKey === requestKey && review.attempt === attempt ? review.result : { state: "loading" };
  return {
    open, available, result,
    onOpenChange: (next: boolean) => {
      if (!next) { setOpenFor(null); setReview(null); }
      else if (available && admitted()) { setReview(null); setOpenFor(requestKey); }
    },
    retry: () => { if (available && admitted()) { setReview(null); setAttempt(value => value + 1); } },
  };
}
