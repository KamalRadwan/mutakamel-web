import { useEffect, useRef, useState } from "react";
import { normalizeApiError } from "@/lib/api/errors";
import { fetchTemplateDraft, type TemplateDraftDocument } from "../../template-design-api";
import { fetchRecoverySnapshots } from "../../template-lifecycle-api";
import type { TemplateRecoverySnapshot } from "../../template-lifecycle-contract";
import type { TemplateCursorPage } from "../../templates-contract";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";

type AuthorityCheck = () => boolean;
type DraftReviewResult = { state: "loading" | "unavailable" | "failed" } | { state: "ready"; draft: TemplateDraftDocument };

export function useTemplateRecoveryFocus(enabled = true) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (enabled) notice.current?.focus(); }, [enabled]);
  return notice;
}
export function useTemplateReviewDialog(current: AuthorityCheck, focus = false) {
  const [open, setOpen] = useState(false);
  const notice = useTemplateRecoveryFocus(focus);
  return { open, notice, onOpenChange: (next: boolean) => setOpen(next && current()) };
}
export function canReviewNewerDraft(base: TemplateDraftDocument, saved: TemplateDraftDocument): boolean {
  return saved.templateId === base.templateId && saved.draftId === base.draftId &&
    saved.revision > base.revision && saved.etag === `"${saved.revision}"`;
}

export function useDraftComparison(base: TemplateDraftDocument, current: AuthorityCheck) {
  const [result, setResult] = useState<DraftReviewResult>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!current()) {
      queueMicrotask(() => setResult({ state: "unavailable" }));
      return;
    }
    const controller = new AbortController();
    void fetchTemplateDraft(base.templateId, controller.signal, base.editorDocument.dataSourceKey).then(
      draft => {
        if (controller.signal.aborted) return;
        setResult(current() && canReviewNewerDraft(base, draft) ? { state: "ready", draft } : { state: "unavailable" });
      },
      cause => {
        if (controller.signal.aborted) return;
        const error = normalizeApiError(cause);
        setResult(!current() || [401, 403, 404].includes(error.status) ? { state: "unavailable" } : { state: "failed" });
      },
    );
    return () => controller.abort();
  }, [attempt, base, current]);

  return { result, retry: () => { setResult({ state: "loading" }); setAttempt(value => value + 1); } };
}

export function useSnapshotPage(templateId: string, current: AuthorityCheck) {
  const cursor = useTemplateCursor();
  const { cursor: active, restart } = cursor;
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<
    { state: "loading" | "failed" | "unavailable" } |
    { state: "ready"; page: TemplateCursorPage<TemplateRecoverySnapshot>; observedAt: number }
  >({ state: "loading" });
  useEffect(() => {
    if (!current()) {
      queueMicrotask(() => setResult({ state: "unavailable" }));
      return;
    }
    const controller = new AbortController();
    void fetchRecoverySnapshots(templateId, { cursor: active, signal: controller.signal }).then(
      page => {
        if (!controller.signal.aborted) setResult(current() ? { state: "ready", page, observedAt: Date.now() } : { state: "unavailable" });
      },
      cause => {
        if (controller.signal.aborted) return;
        const error = normalizeApiError(cause);
        if (!current() || [401, 403, 404].includes(error.status)) setResult({ state: "unavailable" });
        else if (active && isExpiredCursor(error)) restart(true);
        else setResult({ state: "failed" });
      },
    );
    return () => controller.abort();
  }, [active, current, request, restart, templateId]);

  return { cursor, result,
    retry: () => { setResult({ state: "loading" }); setRequest(value => value + 1); },
    previous: () => { setResult({ state: "loading" }); cursor.goBack(); },
    next: () => { if (result.state === "ready" && result.page.nextCursor) { setResult({ state: "loading" }); cursor.advance(result.page.nextCursor); } },
  };
}
