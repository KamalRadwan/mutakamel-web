"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, DegradedBanner, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_MOVEMENT_FORM,
  EMPTY_MOVEMENT_LINE,
  MOVEMENT_LINES_MAX,
  type MovementFormValues,
} from "../movements-contract";

interface MovementPanelProps {
  /** `purchaseOrderId` on a receipt, `salesOrderId` on a delivery. */
  sourceDocumentLabel: string;
  createLabel: string;
  postLabel: string;
  reverseLabel: string;
  createPendingKey: string;
  postPendingKey: string;
  reversePendingKey: string;
  createdId: string | undefined;
  onCreate: (values: MovementFormValues) => Promise<boolean>;
  onPost: (id: string, version: number) => Promise<boolean>;
  onReverse: (
    id: string,
    version: number,
    reasonCode: string,
    effectiveAt: string,
  ) => Promise<boolean>;
  pending: string | null;
  disabled: boolean;
  canReverse: boolean;
  error: string | null;
}

/**
 * Create, post and reverse for one movement family.
 *
 * Receipts and deliveries are the same shape with two field names swapped, so
 * this panel is parameterised rather than duplicated. Reverse is behind its own
 * grant: `trade.inventory.adjust`, never the movement's own permission.
 */
export function MovementPanel({
  sourceDocumentLabel,
  createLabel,
  postLabel,
  reverseLabel,
  createPendingKey,
  postPendingKey,
  reversePendingKey,
  createdId,
  onCreate,
  onPost,
  onReverse,
  pending,
  disabled,
  canReverse,
  error,
}: MovementPanelProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<MovementFormValues>(EMPTY_MOVEMENT_FORM);
  const [actionId, setActionId] = useState("");
  const [actionVersion, setActionVersion] = useState("1");
  const [reasonCode, setReasonCode] = useState("");
  const [reversalAt, setReversalAt] = useState("");
  const set = (patch: Partial<MovementFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));
  const targetId = actionId || (createdId ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.tradeInventory.nodeId} required error={error ?? undefined}>
          <Input
            value={values.nodeId}
            disabled={disabled || pending !== null}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ nodeId: event.target.value })}
          />
        </Field>
        <Field label={sourceDocumentLabel} required>
          <Input
            value={values.sourceDocumentId}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceDocumentId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.sourceDocumentVersion} required>
          <Input
            type="number"
            min={1}
            value={values.sourceDocumentVersion}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceDocumentVersion: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.businessEffectiveAt} required>
          <Input
            type="datetime-local"
            value={values.businessEffectiveAt}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ businessEffectiveAt: event.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground">{t.tradeInventory.lines}</p>
        {values.lines.map((line, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-5">
            <Field label={t.tradeInventory.sourceLineId} required className="md:col-span-2">
              <Input
                value={line.sourceLineId}
                disabled={disabled || pending !== null}
                onChange={(event) =>
                  set({
                    lines: values.lines.map((entry, position) =>
                      position === index ? { ...entry, sourceLineId: event.target.value } : entry,
                    ),
                  })
                }
              />
            </Field>
            <Field label={t.tradeInventory.sourceLineVersion} required>
              <Input
                type="number"
                min={1}
                value={line.sourceLineVersion}
                disabled={disabled || pending !== null}
                onChange={(event) =>
                  set({
                    lines: values.lines.map((entry, position) =>
                      position === index
                        ? { ...entry, sourceLineVersion: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
            </Field>
            <Field label={t.tradeInventory.uomId} required>
              <Input
                value={line.uomId}
                disabled={disabled || pending !== null}
                onChange={(event) =>
                  set({
                    lines: values.lines.map((entry, position) =>
                      position === index ? { ...entry, uomId: event.target.value } : entry,
                    ),
                  })
                }
              />
            </Field>
            <Field label={t.tradeInventory.quantity} required>
              <Input
                value={line.quantity}
                inputMode="decimal"
                disabled={disabled || pending !== null}
                onChange={(event) =>
                  set({
                    lines: values.lines.map((entry, position) =>
                      position === index ? { ...entry, quantity: event.target.value } : entry,
                    ),
                  })
                }
              />
            </Field>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || values.lines.length >= MOVEMENT_LINES_MAX}
            onClick={() => set({ lines: [...values.lines, EMPTY_MOVEMENT_LINE] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.tradeInventory.addLine}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || values.lines.length <= 1}
            onClick={() => set({ lines: values.lines.slice(0, -1) })}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t.tradeInventory.removeLine}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={disabled}
          loading={pending === createPendingKey}
          onClick={() => {
            void onCreate(values).then((saved) => {
              if (saved) setValues(EMPTY_MOVEMENT_FORM);
            });
          }}
        >
          {createLabel}
        </Button>
      </div>

      {createdId ? (
        <DegradedBanner message={`${t.tradeInventory.lastMovementId}: ${createdId}`} />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">{t.tradeInventory.postOrReverse}</p>
        <p className="text-xs text-muted-foreground">{t.tradeInventory.postOrReverseHint}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t.tradeInventory.movementId} required>
            <Input
              value={targetId}
              disabled={disabled || pending !== null}
              onChange={(event) => setActionId(event.target.value)}
            />
          </Field>
          <Field label={t.tradeCommon.version} required hint={t.tradeCommon.ifMatchHint}>
            <Input
              type="number"
              min={1}
              value={actionVersion}
              disabled={disabled || pending !== null}
              onChange={(event) => setActionVersion(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.reasonCode} hint={t.tradeInventory.reasonCodeHint}>
            <Input
              value={reasonCode}
              disabled={disabled || pending !== null || !canReverse}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.reversalEffectiveAt}>
            <Input
              type="datetime-local"
              value={reversalAt}
              disabled={disabled || pending !== null || !canReverse}
              onChange={(event) => setReversalAt(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            loading={pending === postPendingKey}
            onClick={() => void onPost(targetId, Number(actionVersion))}
          >
            {postLabel}
          </Button>
          <Button
            variant="outline"
            disabled={!canReverse}
            loading={pending === reversePendingKey}
            onClick={() =>
              void onReverse(targetId, Number(actionVersion), reasonCode, reversalAt)
            }
          >
            {reverseLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
