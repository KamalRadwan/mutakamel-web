"use client";

import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TRADE_DRAFT_REFERENCE_MAX_LENGTH } from "../trade-document-contract";
import type { TradeDraftReferenceState } from "../hooks/useTradeDraftReference";

export interface TradeDraftReferenceDrawerProps {
  state: TradeDraftReferenceState;
  title: string;
  description: string;
}

/** The one editable field on an order or a quotation header. */
export function TradeDraftReferenceDrawer({
  state,
  title,
  description,
}: TradeDraftReferenceDrawerProps) {
  const { t } = useI18n();

  return (
    <FormDrawer
      open={state.isOpen}
      onOpenChange={(open) => (open ? state.open() : state.close())}
      title={title}
      description={description}
      isDirty={state.isDirty}
      isSubmitting={state.write.isWriting}
      submitDisabled={!state.isDirty}
      onSubmit={() => void state.submit()}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field label={t.tradeDocuments.draftReference} hint={t.tradeDocuments.draftReferenceHint}>
        <Input
          value={state.value}
          maxLength={TRADE_DRAFT_REFERENCE_MAX_LENGTH}
          onChange={(event) => state.setValue(event.target.value)}
        />
      </Field>
    </FormDrawer>
  );
}
