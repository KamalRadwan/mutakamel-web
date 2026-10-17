"use client";

import * as React from "react";
import { ArrowRightLeft, CheckCircle2, FileText } from "lucide-react";
import {
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Money,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeIfMatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import {
  QUOTATIONS_PATH,
  buildConvertQuotationToSalesOrder,
  type QuotationDetail,
} from "../quotation-contract";

export interface ConvertQuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationDetail;
  headers: Record<string, string>;
  onConverted: () => Promise<void>;
}

export function ConvertQuotationDrawer({
  open,
  onOpenChange,
  quotation,
  headers,
  onConverted,
}: ConvertQuotationDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();
  const [taxCode, setTaxCode] = React.useState("VAT-0");

  const payload = React.useMemo(
    () => buildConvertQuotationToSalesOrder(quotation, taxCode),
    [quotation, taxCode],
  );

  async function handleSubmit() {
    const ok = await write.runWrite({
      operation: td.quotations.convert,
      send: (idempotency) =>
        tradePost(
          tradeDocumentActionPath(
            QUOTATIONS_PATH,
            quotation.id,
            "convert-to-sales-order",
          ),
          payload,
          {
            headers: {
              ...headers,
              ...idempotency,
              "if-match": tradeIfMatch(quotation.version),
            },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
    });
    if (ok) {
      onOpenChange(false);
      await onConverted();
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={td.executive.convertTitle}
      description={td.executive.convertDescription}
      isDirty={false}
      isSubmitting={write.isWriting}
      submitDisabled={write.isWriting || quotation.currentLines.length === 0}
      onSubmit={() => void handleSubmit()}
      labels={{
        submit: td.executive.convertSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TradeWriteOutcome write={write} />

      <div className="dossier-card dossier-card-indigo space-y-3">
        <div className="dossier-card-header">
          <div className="dossier-card-title">
            <span className="dossier-icon-pill dossier-ip-indigo" aria-hidden>
              <ArrowRightLeft className="h-4 w-4" />
            </span>
            <span>{td.executive.dossierOverview}</span>
          </div>
          <span className="dossier-tag dossier-tag-emerald">
            <CheckCircle2 className="me-1 h-3 w-3" aria-hidden />
            {td.executive.evidenceVerifiedBadge}
          </span>
        </div>

        <div className="dossier-fields-grid">
          <div className="dossier-field-box">
            <span className="dossier-lbl">{td.documentNumber}</span>
            <span className="dossier-val">
              <IdentifierText>
                {quotation.documentNumber ?? quotation.draftReference ?? quotation.id}
              </IdentifierText>
            </span>
          </div>
          <div className="dossier-field-box">
            <span className="dossier-lbl">{td.executive.linesCount}</span>
            <span className="dossier-val">
              <IdentifierText>{String(quotation.currentLines.length)}</IdentifierText>
            </span>
          </div>
          <div className="dossier-field-box dossier-span-all">
            <span className="dossier-lbl">{td.grandTotal}</span>
            <span className="dossier-val text-base">
              <Money
                value={payload.totals.grandTotal}
                currency={quotation.currencyCode}
                minimumFractionDigits={2}
                maximumFractionDigits={8}
              />
            </span>
          </div>
        </div>
      </div>

      <div className="dossier-card dossier-card-violet space-y-3">
        <div className="dossier-card-header">
          <div className="dossier-card-title">
            <span className="dossier-icon-pill dossier-ip-violet" aria-hidden>
              <FileText className="h-4 w-4" />
            </span>
            <span>{td.executive.structuredTermsTitle}</span>
          </div>
        </div>
        <Field label={td.executive.taxCodeLabel}>
          <Input
            size="sm"
            value={taxCode}
            onChange={(e) => setTaxCode(e.target.value)}
            placeholder="VAT-0"
          />
        </Field>
        <div className="rounded-md bg-muted/40 p-2.5 text-xs">
          <IdentifierText>{JSON.stringify(payload.terms)}</IdentifierText>
        </div>
      </div>
    </FormDrawer>
  );
}
