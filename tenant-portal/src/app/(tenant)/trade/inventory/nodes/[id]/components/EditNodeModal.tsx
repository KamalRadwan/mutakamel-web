"use client";

import { useState } from "react";
import { Pencil, ShieldAlert } from "lucide-react";
import {
  Badge,
  cn,
  FormModal,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import {
  INVENTORY_NODES_MANAGE_PERMISSION,
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
  const { t, lang } = useI18n();
  const initial = toNodeForm(node);
  const [values, setValues] = useState<NodeFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="wide"
      title={`${t.tradeInventory.nodeEditTitle} — ${node.code}`}
      description={t.tradeInventory.nodeEditDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
          )}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </div>
      }
      headerAside={
        <Badge tone="brand" dir="ltr" className="font-mono">
          {`If-Match: "${formatNumber(node.version, lang)}"`}
        </Badge>
      }
      footerLeading={
        <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
          COMPANY • {INVENTORY_NODES_MANAGE_PERMISSION}
        </span>
      }
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
        sections: t.tradeInventory.nodeEditTitle,
        sectionInvalid: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-3">
        {values.status === "INACTIVE" && node.status === "ACTIVE" ? (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t.tradeInventory.errorNodeInUse}</span>
          </div>
        ) : null}

        <NodeFormFields
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          isSubmitting={isSubmitting}
          isEdit
        />
      </div>
    </FormModal>
  );
}
