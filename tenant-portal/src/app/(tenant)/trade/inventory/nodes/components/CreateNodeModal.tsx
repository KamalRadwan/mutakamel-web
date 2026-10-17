"use client";

import { useState } from "react";
import { Warehouse } from "lucide-react";
import {
  Badge,
  cn,
  FormModal,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_NODE_FORM,
  INVENTORY_NODES_MANAGE_PERMISSION,
  parseBranchIdsPreview,
  type NodeFormValues,
} from "../../inventory-contract";
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
  const branchPreview = parseBranchIdsPreview(values.branchIds);
  const readyCount = [
    values.code.trim().length > 0,
    values.name.trim().length > 0,
    values.timezone.trim().length > 0,
    branchPreview.validIds.length > 0 && branchPreview.invalidEntries.length === 0,
  ].filter(Boolean).length;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_NODE_FORM);
          onClose();
        }
      }}
      size="wide"
      title={t.tradeInventory.nodeCreateTitle}
      description={t.tradeInventory.nodeCreateDescription}
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
      headerAside={
        <Badge tone={readyCount === 4 ? "positive" : "brand"}>
          {`${readyCount}/4`}
        </Badge>
      }
      footerLeading={
        <span className="font-mono text-2xs text-muted-foreground">
          COMPANY • {INVENTORY_NODES_MANAGE_PERMISSION}
        </span>
      }
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
        sections: t.tradeInventory.nodeCreateTitle,
        sectionInvalid: t.common.cancel,
      }}
    >
      <NodeFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
      />
    </FormModal>
  );
}
