"use client";

import { AlertCircle } from "lucide-react";
import { IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";

export function QuotationWriteFeedback({ write }: { write: TradeWriteState }) {
  const { t } = useI18n();
  const error = write.writeError;
  const copy = t.quotationExperience;
  if (!error) return null;
  return <section role="alert" className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{copy.writeRejected}</h2>
    <p className="text-sm">{tradeDocumentMessage(error.code, t.tradeDocuments.errors) ?? (error.status === 403 ? copy.writePermission : copy.writeRetryHint)}</p>
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><div className="flex gap-2"><dt>{copy.errorCode}</dt><dd><IdentifierText>{error.code}</IdentifierText></dd></div>{error.correlationId ? <div className="flex gap-2"><dt>{t.errors.reference}</dt><dd><IdentifierText>{error.correlationId}</IdentifierText></dd></div> : null}</dl>
  </section>;
}
