"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeApiError } from "@/lib/api/errors";
import { fetchTemplateDraft, type TemplateDraftDocument } from "../../template-design-api";
import { admitDesignerDocument } from "../../designer-command-store";
import type { EditorDocument } from "../../template-editor-model";
import { compareTemplateDocuments } from "../../template-conflict-comparison";
import { isNewerTemplateDraft, sameTemplateRecoveryAuthority, type TemplateRecoveryAuthority } from "../../template-recovery-policy";
import { useTemplateConflictDialogFocus, type TemplateRecoveryInteraction } from "./useTemplateConflictDialogFocus";

export interface TemplateConflictReviewInput {
  base: TemplateDraftDocument;
  local: EditorDocument;
  authority: TemplateRecoveryAuthority;
  blocked: boolean;
  onReload: () => void;
  interaction?: TemplateRecoveryInteraction;
}
type ReviewState = { state: "loading" | "failed" | "denied" | "unavailable" } |
  { state: "ready"; draft: TemplateDraftDocument };
type ReviewToken = Pick<TemplateConflictReviewInput, "authority" | "base">;
type BoundReview = ReviewToken & { result: ReviewState; attempt: number };
type DiscardToken = ReviewToken & { local: EditorDocument };

/** Owns GET/review/discard UX; the editor remains the sole save-flight and receipt owner. */
export function useTemplateConflictReview(input: TemplateConflictReviewInput) {
  const { host, comparison: comparisonRoot, discard: discardRoot, comparisonLifecycle, discardLifecycle, beforeClose, beforeConfirm } = useTemplateConflictDialogFocus(input);
  const { base, local, authority, blocked } = input;
  const live = useRef(input);
  useLayoutEffect(() => { live.current = input; });
  const [openFor, setOpenFor] = useState<ReviewToken | null>(null);
  const [discardFor, setDiscardFor] = useState<DiscardToken | null>(null);
  const discardRef = useRef<DiscardToken | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState<BoundReview | null>(null);
  const notice = useRef<HTMLDivElement>(null);
  const tokenMatches = (token: ReviewToken | null) => !!token &&
    sameTemplateRecoveryAuthority(token.authority, authority) && token.base === base;
  const available = authority.readable && !blocked;
  const open = available && tokenMatches(openFor);
  const confirmingDiscard = available && tokenMatches(discardFor) && discardFor?.local === local;
  const { key, epoch, readable } = authority;

  useEffect(() => { if (readable && !blocked) notice.current?.focus(); }, [key, epoch, readable, blocked]);
  useLayoutEffect(() => {
    const wrongOwner = openFor && (!sameTemplateRecoveryAuthority(openFor.authority, authority) || openFor.base !== base);
    if (available && !wrongOwner) return;
    discardRef.current = null;
    // Purge bodies and open intent after a committed fence; returning permission must not reopen an old review.
    queueMicrotask(() => { setOpenFor(null); setReview(null); setDiscardFor(null); });
  }, [available, authority, base, openFor]);
  useEffect(() => {
    if (!open || !live.current.authority.current()) return;
    const controller = new AbortController();
    const captured: ReviewToken = { authority: live.current.authority, base };
    const stillCurrent = () => {
      const now = live.current;
      return !controller.signal.aborted && !now.blocked && now.authority.readable &&
        sameTemplateRecoveryAuthority(captured.authority, now.authority) && now.base === captured.base && now.authority.current();
    };
    void fetchTemplateDraft(base.templateId, controller.signal, base.editorDocument.dataSourceKey).then(draft => {
      if (!stillCurrent()) return;
      let result: ReviewState = { state: "unavailable" };
      if (isNewerTemplateDraft(base, draft)) {
        try {
          result = { state: "ready", draft: { ...draft, editorDocument: admitDesignerDocument(draft.editorDocument, base.editorDocument) } };
        } catch { result = { state: "unavailable" }; }
      }
      if (stillCurrent()) setReview({ ...captured, result, attempt });
    }, cause => {
      if (!stillCurrent()) return;
      const error = normalizeApiError(cause);
      const state = error.status === 403 ? "denied" : [401, 404].includes(error.status) ? "unavailable" : "failed";
      setReview({ ...captured, result: { state }, attempt });
    });
    return () => controller.abort();
  }, [open, attempt, base, key, epoch]);

  const result: ReviewState = !available ? { state: "unavailable" } :
    review && tokenMatches(review) && review.attempt === attempt ? review.result : { state: "loading" };
  const saved = result.state === "ready" ? result.draft : null;
  const comparison = useMemo(() => saved
    ? compareTemplateDocuments(base.editorDocument, local, saved.editorDocument) : null, [base.editorDocument, local, saved]);
  const admitted = () => {
    const now = live.current;
    return now.authority.readable && !now.blocked && now.authority.current();
  };
  const closeReview = () => { discardRef.current = null; setOpenFor(null); setReview(null); setDiscardFor(null); };
  return {
    notice, host, comparisonRoot, discardRoot, comparisonLifecycle, discardLifecycle, open, result, comparison, confirmingDiscard,
    onOpenChange: (next: boolean) => {
      if (!next) { if (beforeClose()) closeReview(); return; }
      if (admitted()) {
        const now = live.current;
        setReview(null); setOpenFor({ authority: now.authority, base: now.base });
      }
    },
    retry: () => { if (admitted()) { setReview(null); setAttempt(value => value + 1); } },
    requestReload: () => {
      if (!admitted()) return;
      const now = live.current;
      discardRef.current = { authority: now.authority, base: now.base, local: now.local };
      setDiscardFor(discardRef.current);
    },
    cancelDiscard: () => { if (beforeClose()) { discardRef.current = null; setDiscardFor(null); } },
    confirmReload: () => {
      if (!beforeConfirm()) return;
      const captured = discardRef.current, now = live.current;
      discardRef.current = null;
      setDiscardFor(null);
      if (!captured || !admitted() || !sameTemplateRecoveryAuthority(captured.authority, now.authority) ||
        captured.base !== now.base || captured.local !== now.local) return;
      closeReview();
      now.onReload();
    },
  };
}
