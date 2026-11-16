"use client";

import { Warehouse } from "lucide-react";
import {
  cn,
  Button,
  FormModal,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_NODE_FORM,
  type NodeFormValues,
} from "../../inventory-contract";
import { NodeFormFields } from "./NodeFormFields";
import { useNodeForm } from "../hooks/useNodeForm";

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NodeFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  initialValues?: NodeFormValues;
  unresolved?: boolean;
  onRetryOriginal?: () => Promise<boolean>;
  canRetryOriginal?: boolean;
}

export function CreateNodeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  initialValues,
  unresolved = false,
  onRetryOriginal,
  canRetryOriginal = false,
}: CreateNodeModalProps) {
  const { t } = useI18n();
  const form = useNodeForm(initialValues ?? EMPTY_NODE_FORM, onSubmit);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && (!unresolved || !canRetryOriginal)) {
          form.reset();
          onClose();
        }
      }}
      size="wide"
      title={t.tradeInventory.nodeCreateTitle}
      description={t.tradeInventory.nodeCreateDescription}
      footerLeading={unresolved ? <div className="flex flex-col gap-2"><p role="status" className="text-caption text-muted-foreground">{t.tradeInventory.governanceUnknownWrite}</p><Button variant="outline" disabled={!canRetryOriginal || isSubmitting} onClick={() => void onRetryOriginal?.()}>{t.tradeInventory.governanceRetryOriginal}</Button></div> : <span className="text-caption text-muted-foreground">{t.tradeInventory.nodeStartsActive}</span>}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
          )}
        >
          <Warehouse className="size-4" aria-hidden="true" />
        </div>
      }
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={unresolved}
      onSubmit={() => void form.submit()}
      error={error ?? form.error ?? undefined}
      labels={{
        submit: t.tradeInventory.nodeCreate,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradeInventory.nodeCreateTitle,
        sectionInvalid: t.common.cancel,
      }}
    >
      <NodeFormFields
        values={form.values}
        errors={form.fieldErrors}
        onChange={form.patch}
        isSubmitting={isSubmitting || unresolved}
        isEdit={false}
      />
    </FormModal>
  );
}
