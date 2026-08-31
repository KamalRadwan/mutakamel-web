"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_NODE_FORM, type NodeFormValues } from "../../inventory-contract";
import { NodeFormFields } from "./NodeFormFields";

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NodeFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateNodeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateNodeModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<NodeFormValues>(EMPTY_NODE_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_NODE_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_NODE_FORM);
          onClose();
        }
      }}
      title={t.tradeInventory.nodeCreateTitle}
      description={t.tradeInventory.nodeCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_NODE_FORM);
        });
      }}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <NodeFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
      />
    </FormDrawer>
  );
}
