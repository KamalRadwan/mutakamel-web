"use client";

import { useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite, type WriteAttempt } from "@/lib/api/idempotent-write";
import { parseWidgetDraftState, widgetDraftPath, widgetDraftPrecondition, type WidgetDraftState } from "../../widget-draft-contract";
import { parseWidgetImpact, parseWidgetPublicationReceipt, publicationPrecondition, widgetImpactPath, widgetPublishPath, type WidgetImpact } from "../../widget-publication-contract";
import { assertWidgetStatus, sameWidgetValue, uncertainWidgetWrite, WIDGET_WRITE } from "../../hooks/widget-requests";
import type { useWidgetSafety, WidgetWriteTicket } from "../../hooks/useWidgetSafety";

const DRAFT_CONFLICTS = new Set(["CRM_WIDGET_REVISION_CONFLICT", "CRM_WIDGET_DRAFT_CONFLICT", "CRM_WIDGET_DRAFT_BASE_CONFLICT"]);
const REVIEW_CONFLICTS = new Set([...DRAFT_CONFLICTS, "CRM_WIDGET_PUBLISH_IMPACT_STALE"]);
const IMPACT_READ = { ...WIDGET_WRITE, maxResponseBytes: 4 * 1024 * 1024 };
type Action = "inspect" | "publish" | "discard";
type Review = { scope: string; impact: WidgetImpact; attempt: WriteAttempt; unconfirmed: boolean };
type Failure = { scope: string; action: Action; error: NormalizedApiError };

interface Options {
  widgetId: string;
  safety: ReturnType<typeof useWidgetSafety>;
  canPublish: boolean;
  canDiscard: boolean;
  currentDraft: () => WidgetDraftState | null;
  refresh: (ticket: WidgetWriteTicket) => Promise<boolean>;
}

export function useWidgetLifecycle({ widgetId, safety, canPublish, canDiscard, currentDraft, refresh }: Options) {
  const { scope } = safety;
  const currentReview = useRef<Review | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState<{ scope: string; action: Action } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [discardTarget, setDiscardTarget] = useState<{ scope: string; base: WidgetDraftState } | null>(null);
  const [dashboardPage, setDashboardPage] = useState(1);
  const visibleReview = canPublish && review?.scope === scope ? review : null;
  const action = pending?.scope === scope ? pending.action : null;

  function storeReview(value: Review | null) {
    currentReview.current = value;
    setReview(value);
  }

  function start(action: Action, allowed: boolean) {
    const ticket = safety.beginWrite(allowed);
    if (ticket) {
      setPending({ scope, action });
      setFailure(null);
    }
    return ticket;
  }

  function finish(ticket: WidgetWriteTicket) {
    const active = safety.currentWrite(ticket);
    safety.finish(ticket);
    if (active) setPending(null);
  }

  async function inspect() {
    const base = currentDraft();
    const body = base && publicationPrecondition(base);
    if (!base || !body || currentReview.current?.scope === scope) return;
    const ticket = start("inspect", canPublish);
    if (!ticket) return;
    try {
      const response = await axiosClient.post<unknown>(widgetImpactPath(widgetId), body, IMPACT_READ);
      if (!safety.currentWrite(ticket)) return;
      assertWidgetStatus(response, 200);
      const impact = parseWidgetImpact(response.data, base);
      setDashboardPage(1);
      storeReview({ scope, impact, attempt: createWriteAttempt(), unconfirmed: false });
    } catch (caught) {
      if (!safety.currentWrite(ticket)) return;
      const error = normalizeApiError(caught);
      setFailure({ scope, action: "inspect", error });
      if (REVIEW_CONFLICTS.has(error.code ?? "")) await refresh(ticket);
    } finally { finish(ticket); }
  }

  async function confirm() {
    const command = currentReview.current;
    if (command?.scope !== scope || !canPublish) return;
    const ticket = start("publish", true);
    if (!ticket) return;
    try {
      if (!command.unconfirmed) {
        const draft = currentDraft();
        const expected = draft && publicationPrecondition(draft);
        const { impactId, ...reviewed } = command.impact.body;
        if (!expected || !sameWidgetValue(expected, reviewed)) {
          storeReview(null);
          setFailure({ scope, action: "publish", error: { status: 409, code: "CRM_WIDGET_PUBLISH_IMPACT_STALE", message: "" } });
          return;
        }
      }
      const outcome = await runIdempotentWrite({
        attempt: command.attempt, method: "post", path: widgetPublishPath(widgetId), body: command.impact.body, config: WIDGET_WRITE,
        parse: (payload, response) => {
          assertWidgetStatus(response, 200);
          return parseWidgetPublicationReceipt(payload, widgetId, command.impact);
        },
      });
      if (!safety.currentWrite(ticket)) return;
      if (outcome.kind === "success") {
        const refreshed = await refresh(ticket);
        if (!safety.currentWrite(ticket)) return;
        if (!refreshed) safety.fence(ticket);
        storeReview(null);
        return { versionNumber: outcome.value.versionNumber, refreshed };
      }
      const error = outcome.error;
      setFailure({ scope, action: "publish", error });
      if (outcome.kind === "failed" && REVIEW_CONFLICTS.has(error.code ?? "")) {
        storeReview(null);
        await refresh(ticket);
      } else if (outcome.kind !== "failed" || command.unconfirmed) {
        // The server checks the command receipt before proof expiry or draft state.
        storeReview({ ...command, unconfirmed: true });
      }
    } finally { finish(ticket); }
  }

  async function discard() {
    const base = discardTarget?.scope === scope ? discardTarget.base : null;
    const draft = base?.draft;
    if (!base || !draft) return;
    const current = currentDraft();
    if (!current || !sameWidgetValue(widgetDraftPrecondition(current), widgetDraftPrecondition(base))) {
      setDiscardTarget(null);
      setFailure({ scope, action: "discard", error: { status: 409, code: "CRM_WIDGET_DRAFT_CONFLICT" } });
      return;
    }
    const ticket = start("discard", canDiscard);
    if (!ticket) return;
    try {
      const response = await axiosClient.post<unknown>(`${widgetDraftPath(widgetId)}/discard`, {
        expectedWidgetRevision: base.widgetRevision, expectedDraftId: draft.draftId, expectedDraftRevision: draft.revision,
      }, WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) return;
      assertWidgetStatus(response, 200);
      const state = parseWidgetDraftState(response.data);
      if (state.widgetId !== widgetId || state.widgetRevision !== base.widgetRevision
        || state.activeVersionNumber !== base.activeVersionNumber || state.draft !== null) {
        throw new Error("Widget draft discard receipt does not match.");
      }
      const refreshed = await refresh(ticket);
      if (!safety.currentWrite(ticket)) return;
      if (!refreshed) safety.fence(ticket);
      setDiscardTarget(null);
      return { refreshed };
    } catch (caught) {
      if (!safety.currentWrite(ticket)) return;
      const error = normalizeApiError(caught);
      setFailure({ scope, action: "discard", error });
      if (DRAFT_CONFLICTS.has(error.code ?? "")) {
        setDiscardTarget(null);
        await refresh(ticket);
      } else if (uncertainWidgetWrite(error)) {
        setDiscardTarget(null);
        safety.fence(ticket);
        await refresh(ticket);
      }
    } finally { finish(ticket); }
  }

  return { action, canPublish, review: visibleReview, dashboardPage, setDashboardPage, failure: failure?.scope === scope ? failure : null,
    discardOpen: canDiscard && discardTarget?.scope === scope, inspect, confirm, discard,
    closeReview: () => {
      const command = currentReview.current;
      if (command?.scope === scope && !command.unconfirmed && !safety.isPending()) {
        storeReview(null);
        setFailure(null);
      }
    },
    setDiscardOpen: (open: boolean) => {
      if (safety.isPending()) return;
      const base = open ? currentDraft() : null;
      if (!open || canDiscard && base?.draft && !visibleReview) {
        setDiscardTarget(base ? { scope, base } : null);
        setFailure(null);
      }
    },
  };
}
