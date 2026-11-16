"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OutboundEmailRecipientReference, OutboundEmailSourceType } from "../outbound-email-contract";
import { useOutboundEmailComposer, type SendResult } from "./useOutboundEmailComposer";
import { useOutboundEmails } from "./useOutboundEmails";

export function useOutboundEmailPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const history = useOutboundEmails();
  const composer = useOutboundEmailComposer();
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [composeError, setComposeError] = useState<string>();

  function finish(result: SendResult) {
    if (result.accepted) {
      setComposeOpen(false); setComposeError(undefined); composer.reset();
      if (result.replayed) toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      else toast.success(t.crmOutboundEmails.queuedTitle, t.crmOutboundEmails.queuedDescription);
      void history.reload();
    } else if (result.error) {
      setComposeError(result.error.status === 403 ? t.crmOutboundEmails.sourceAccess : t.crmOutboundEmails.errors[result.error.code ?? ""] ?? t.crmOutboundEmails.sendFailed);
    }
  }

  return {
    t, history, composer, isComposeOpen: isComposeOpen && history.canSend,
    session: `${composer.scope}:${session}`, composeError,
    clearComposeError: () => setComposeError(undefined),
    openComposer: () => {
      if (!history.canSend || !composer.reset()) return;
      setComposeError(undefined); setSession((current) => current + 1); setComposeOpen(true);
    },
    closeComposer: (open: boolean) => {
      if (!open && composer.isBlocked()) return;
      if (!open) { composer.reset(); setComposeError(undefined); }
      setComposeOpen(open);
    },
    send: (sourceType: OutboundEmailSourceType, sourceId: string, recipient: OutboundEmailRecipientReference, template: string | null) => {
      void composer.send(sourceType, sourceId, recipient, template).then(finish);
    },
    reconcile: () => { void composer.reconcile().then(finish); },
    openDetail: (id: string) => router.push(`/crm/outbound-emails/${encodeURIComponent(id)}`),
  };
}
