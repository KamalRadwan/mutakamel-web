"use client";

import { Lock, PenLine } from "lucide-react";
import {
  Badge,
  Field,
  FormModal,
  IdentifierText,
  Input,
} from "@/design-system";
import {
  TRADE_DRAFT_REFERENCE_MAX_LENGTH,
  partyDisplayName,
} from "../../documents/trade-document-contract";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import {
  type QuotationDetail,
} from "../quotation-contract";
import { useQuotationHeaderEditor } from "../hooks/useQuotationHeaderEditor";
import { QuotationContactPicker } from "./QuotationContactPicker";
import { QuotationWriteFeedback } from "./QuotationWriteFeedback";

export interface EditQuotationHeaderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationDetail;
  headers: Record<string, string>;
  onSaved: () => Promise<void>;
}

/**
 * Centered Card Modal (`FormModal size="card"`) for `PATCH /quotations/:id`.
 *
 * Replaces legacy side drawer (`TradeDraftReferenceDrawer`) on Quotations and
 * supports both mutable fields on `UpdateQuotationDto`: `draftReference` and
 * `contactPartyId`, while displaying why `partyId` and `currencyCode` are locked.
 */
export function EditQuotationHeaderModal(props: EditQuotationHeaderModalProps) {
  const { open, quotation } = props;
  return (
    <EditQuotationHeaderModalInner
      key={`${quotation.id}:${quotation.version}:${open ? "open" : "closed"}`}
      {...props}
    />
  );
}

function EditQuotationHeaderModalInner({
  open,
  onOpenChange,
  quotation,
  headers,
  onSaved,
}: EditQuotationHeaderModalProps) {
  const editor = useQuotationHeaderEditor({ open, onOpenChange, quotation, headers, onSaved });
  const { t, write, draftReference } = editor;
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  return (
    <FormModal
      open={open}
      onOpenChange={editor.changeOpen}
      size="card"
      title={qCopy.editHeaderModalTitle}
      description={qCopy.editHeaderModalDescription}
      headerIcon={
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
        >
          <PenLine className="size-4" />
        </span>
      }
      titleBadge={
        <Badge tone="brand" size="sm">
          {t.quotationExperience.recordVersion} <IdentifierText>{`v${quotation.version}`}</IdentifierText>
        </Badge>
      }
      isDirty={editor.isDirty}
      isSubmitting={write.isWriting}
      submitDisabled={!editor.canSubmit}
      onSubmit={() => void editor.submit()}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: qCopy.editHeaderModalTitle,
        sectionInvalid: t.quotationExperience.contactUnavailable,
      }}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <TradeWriteOutcome write={write} />
        <QuotationWriteFeedback write={write} />

        {/* Read-only immutable party + currency summary */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/35 p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" />
              {td.customer} ({qCopy.immutableAfterCreate})
            </span>
            <span className="text-xs font-semibold text-foreground">
              {partyDisplayName(quotation.partySnapshot) ?? td.notRecorded}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" />
              {td.currency} ({qCopy.immutableAfterCreate})
            </span>
            <span className="text-xs font-semibold text-foreground">
              <IdentifierText>{quotation.currencyCode}</IdentifierText>
            </span>
          </div>
        </div>

        <Field label={td.draftReference} hint={td.draftReferenceHint} showLabel>
          <Input
            size="sm"
            value={draftReference}
            maxLength={TRADE_DRAFT_REFERENCE_MAX_LENGTH}
            placeholder="RFQ-2026-001"
            disabled={write.isBlocked}
            onChange={(event) => editor.setDraftReference(event.target.value)}
          />
        </Field>

        <QuotationContactPicker contacts={editor.contacts} selectedContact={editor.selectedContact}
          selectedId={editor.contactPartyId || undefined} onSelect={editor.selectContact} disabled={write.isBlocked} />
      </div>
    </FormModal>
  );
}
