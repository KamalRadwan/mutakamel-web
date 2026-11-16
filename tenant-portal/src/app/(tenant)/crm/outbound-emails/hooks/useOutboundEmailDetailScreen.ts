"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useOutboundEmailDetail, type RetryResult } from "./useOutboundEmailDetail";
import { buildRetryRequest } from "../outbound-email-contract";

export function useOutboundEmailDetailScreen(id: string) {
  const detail = useOutboundEmailDetail(id);
  const { t } = detail;
  const toast = useToast();
  const router = useRouter();
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryScope, setRetryScope] = useState(detail.scope);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const visible = retryScope === detail.scope;
  const navigation = useUnsavedChangesGuard(visible && retryOpen && reason.length > 0);
  let invalid = false;
  try { buildRetryRequest(reason); } catch { invalid = true; }

  function finish(result: RetryResult) {
    if (result.ok) {
      setRetryOpen(false);
      if (result.replayed) toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      else toast.success(t.crmOutboundEmails.retryQueuedTitle, t.crmOutboundEmails.retryQueuedDescription);
      router.push(`/crm/outbound-emails/${encodeURIComponent(result.outboundEmailId)}`);
    } else {
      setError(result.error.status === 403 ? t.crmOutboundEmails.sourceAccess : t.crmOutboundEmails.errors[result.error.code ?? ""] ?? t.crmOutboundEmails.retryFailed);
    }
  }
  return {
    detail, retryOpen: visible && retryOpen, reason: visible ? reason : "", navigation,
    error: visible ? error : undefined, reasonError: visible && touched && invalid ? t.crmOutboundEmails.reasonInvalid : undefined,
    reasonCount: [...reason.normalize("NFC").trim()].length,
    isDirty: reason.length > 0,
    openRetry: () => { if (!detail.canRetry) return; setRetryScope(detail.scope); setReason(""); setError(undefined); setTouched(false); setRetryOpen(true); },
    changeOpen: (open: boolean) => { if (!detail.isRetrying && !detail.uncertain) setRetryOpen(open); },
    changeReason: (next: string) => { if (!detail.isRetrying && !detail.uncertain) { setReason(next); setError(undefined); } },
    blurReason: () => setTouched(true),
    submitRetry: () => {
      setTouched(true);
      if (!invalid && detail.canRetry && !detail.isRetrying && !detail.uncertain) void detail.retry(reason).then(finish);
    },
    reconcile: () => { void detail.reconcile().then(finish); },
  };
}
