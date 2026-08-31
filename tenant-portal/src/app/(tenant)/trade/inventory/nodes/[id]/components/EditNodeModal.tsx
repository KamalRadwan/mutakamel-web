"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  toNodeForm,
  type InventoryNodeDetail,
  type NodeFormValues,
} from "../../../inventory-contract";
import { NodeFormFields } from "../../components/NodeFormFields";

interface EditNodeModalProps {
  node: InventoryNodeDetail;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NodeFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function EditNodeModal({
  node,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditNodeModalProps) {
  const { t } = useI18n();
  const initial = toNodeForm(node);
  const [values, setValues] = useState<NodeFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.tradeInventory.nodeEditTitle}
      description={t.tradeInventory.nodeEditDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
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
        isEdit
      />
    </FormDrawer>
  );
}
