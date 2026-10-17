"use client";

import { useState } from "react";
import {
  Barcode,
  CheckCircle2,
  PackageCheck,
  Plus,
  RotateCcw,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DegradedBanner,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { InventoryNode } from "../../inventory-contract";
import {
  EMPTY_MOVEMENT_FORM,
  EMPTY_MOVEMENT_LINE,
  MOVEMENT_LINES_MAX,
  REVERSAL_REASON_PRESETS,
  type MovementFormValues,
  type MovementLineValues,
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
  isDelivery?: boolean;
  knownNodes?: InventoryNode[];
  selectedTargetId?: string;
  selectedTargetVersion?: number;
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
  isDelivery = false,
  knownNodes = [],
  selectedTargetId,
  selectedTargetVersion,
}: MovementPanelProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [values, setValues] = useState<MovementFormValues>(EMPTY_MOVEMENT_FORM);
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});
  const [actionId, setActionId] = useState("");
  const [actionVersion, setActionVersion] = useState("1");
  const [reasonCode, setReasonCode] = useState("");
  const [reversalAt, setReversalAt] = useState("");

  const set = (patch: Partial<MovementFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const updateLine = (index: number, patch: Partial<MovementLineValues>) => {
    set({
      lines: values.lines.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    });
  };

  const targetId = actionId || selectedTargetId || (createdId ?? "");
  const effectiveVersion =
    actionVersion !== "1"
      ? actionVersion
      : selectedTargetVersion
        ? String(selectedTargetVersion)
        : "1";

  const headerPalette = isDelivery
    ? SWATCH_SURFACE_PALETTES.purple
    : SWATCH_SURFACE_PALETTES.teal;
  const HeaderIcon = isDelivery ? Truck : PackageCheck;

  return (
    <div className="flex flex-col gap-4">
      {/* Stage 1: Create Movement Document & Multi-Line Builder */}
      <Card className="flex flex-col gap-4 border border-border/80 p-4">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-s-4 p-3.5",
            headerPalette.sectionCard,
            headerPalette.accentBorder,
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                headerPalette.iconBoxIdle,
              )}
            >
              <HeaderIcon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{createLabel}</h2>
              <p className="text-xs text-muted-foreground">
                {isDelivery
                  ? isAr
                    ? "إنشاء إذن تسليم صادر مرتبط بأمر البيع مع دعم فك الحجز وتتبع الدفعات والأرقام التسلسلية"
                    : "Create outbound delivery document linked to Sales Order with reservation consumption & serial/lot tracking"
                  : isAr
                    ? "إنشاء إذن استلام وارد مرتبط بأمر الشراء مع دعم تتبع الدفعات والأرقام التسلسلية والصلاحية"
                    : "Create inbound receipt document linked to Purchase Order with lot, serial & expiration tracking"}
              </p>
            </div>
          </div>
          <Badge tone="brand">
            {values.lines.length} / {MOVEMENT_LINES_MAX} {t.tradeInventory.lines}
          </Badge>
        </div>

        {/* Node Quick-Select Pills */}
        {knownNodes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
              <Warehouse className="size-3.5" aria-hidden="true" />
              {isAr ? "عقدة التنفيذ:" : "Fulfillment Node:"}
            </span>
            {knownNodes.slice(0, 8).map((node) => {
              const active = values.nodeId.trim() === node.id;
              return (
                <Button
                  key={node.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || pending !== null}
                  onClick={() => set({ nodeId: node.id })}
                  className={`h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors ${
                    active
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {node.code}
                </Button>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label={t.tradeInventory.nodeId} required error={error ?? undefined}>
            <Input
              size="sm"
              value={values.nodeId}
              disabled={disabled || pending !== null}
              placeholder={t.tradeInventory.uuidPlaceholder}
              onChange={(event) => set({ nodeId: event.target.value })}
            />
          </Field>
          <Field label={sourceDocumentLabel} required>
            <Input
              size="sm"
              placeholder={t.tradeInventory.uuidPlaceholder}
              value={values.sourceDocumentId}
              disabled={disabled || pending !== null}
              onChange={(event) => set({ sourceDocumentId: event.target.value })}
            />
          </Field>
          <Field label={t.tradeInventory.sourceDocumentVersion} required>
            <Input
              size="sm"
              placeholder="1"
              type="number"
              min={1}
              value={values.sourceDocumentVersion}
              disabled={disabled || pending !== null}
              onChange={(event) => set({ sourceDocumentVersion: event.target.value })}
            />
          </Field>
          <Field label={t.tradeInventory.businessEffectiveAt} required>
            <Input
              size="sm"
              placeholder={t.tradeInventory.businessEffectiveAt}
              type="datetime-local"
              value={values.businessEffectiveAt}
              disabled={disabled || pending !== null}
              onChange={(event) => set({ businessEffectiveAt: event.target.value })}
            />
          </Field>
        </div>

        {/* Dynamic Lines Builder */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.tradeInventory.lines} ({values.lines.length})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={disabled || values.lines.length >= MOVEMENT_LINES_MAX}
                onClick={() => set({ lines: [...values.lines, EMPTY_MOVEMENT_LINE] })}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradeInventory.addLine}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={disabled || values.lines.length <= 1}
                onClick={() => set({ lines: values.lines.slice(0, -1) })}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t.tradeInventory.removeLine}
              </Button>
            </div>
          </div>

          {values.lines.map((line, index) => {
            const isExpanded = Boolean(expandedLines[index]);
            const serialCount = (line.serialKeys ?? "")
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0).length;

            return (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/15 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="neutral">
                    Line #{index + 1}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedLines((prev) => ({
                        ...prev,
                        [index]: !prev[index],
                      }))
                    }
                    className="inline-flex h-auto items-center gap-1 px-1.5 py-0.5 text-2xs font-semibold text-primary hover:underline"
                  >
                    <Barcode className="size-3.5" aria-hidden="true" />
                    <span>
                      {isExpanded
                        ? isAr
                          ? "إخفاء خيارات التتبع والحجز"
                          : "Hide Tracking & Reservation Fields"
                        : isAr
                          ? "إضافة دفعة / أرقام تسلسلية / حجز (اختياري)"
                          : "+ Lot / Serials / Reservation Options"}
                    </span>
                    {serialCount > 0 ? (
                      <Badge tone="brand">
                        {serialCount} SN
                      </Badge>
                    ) : null}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <Field
                    label={t.tradeInventory.sourceLineId}
                    required
                    className="md:col-span-2"
                  >
                    <Input
                      size="sm"
                      placeholder={t.tradeInventory.uuidPlaceholder}
                      value={line.sourceLineId}
                      disabled={disabled || pending !== null}
                      onChange={(event) =>
                        updateLine(index, { sourceLineId: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={t.tradeInventory.sourceLineVersion} required>
                    <Input
                      size="sm"
                      placeholder="1"
                      type="number"
                      min={1}
                      value={line.sourceLineVersion}
                      disabled={disabled || pending !== null}
                      onChange={(event) =>
                        updateLine(index, { sourceLineVersion: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={t.tradeInventory.uomId} required>
                    <Input
                      size="sm"
                      placeholder={t.tradeInventory.uuidPlaceholder}
                      value={line.uomId}
                      disabled={disabled || pending !== null}
                      onChange={(event) =>
                        updateLine(index, { uomId: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={t.tradeInventory.quantity} required>
                    <Input
                      size="sm"
                      placeholder="10"
                      value={line.quantity}
                      inputMode="decimal"
                      disabled={disabled || pending !== null}
                      onChange={(event) =>
                        updateLine(index, { quantity: event.target.value })
                      }
                    />
                  </Field>
                </div>

                {isExpanded ? (
                  <div className="grid gap-3 border-t border-border/60 pt-3 md:grid-cols-3">
                    <Field
                      label={isAr ? "معرّف الدفعة (lotKey)" : "Lot Key (lotKey)"}
                    >
                      <Input
                        size="sm"
                        placeholder="LOT-2026-01"
                        value={line.lotKey ?? ""}
                        disabled={disabled || pending !== null}
                        onChange={(event) =>
                          updateLine(index, { lotKey: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        isAr
                          ? "الأرقام التسلسلية (serialKeys)"
                          : "Serial Keys (comma/space separated)"
                      }
                    >
                      <Input
                        size="sm"
                        placeholder="SN-001, SN-002"
                        value={line.serialKeys ?? ""}
                        disabled={disabled || pending !== null}
                        onChange={(event) =>
                          updateLine(index, { serialKeys: event.target.value })
                        }
                      />
                    </Field>
                    {isDelivery ? (
                      <Field
                        label={
                          isAr
                            ? "معرّف الحجز المرتبط (reservationId)"
                            : "Linked Reservation UUID (reservationId)"
                        }
                      >
                        <Input
                          size="sm"
                          placeholder={t.tradeInventory.uuidPlaceholder}
                          value={line.reservationId ?? ""}
                          disabled={disabled || pending !== null}
                          onChange={(event) =>
                            updateLine(index, { reservationId: event.target.value })
                          }
                        />
                      </Field>
                    ) : (
                      <Field
                        label={
                          isAr
                            ? "تاريخ انتهاء الصلاحية (expiresAt)"
                            : "Expiration Date (expiresAt)"
                        }
                      >
                        <Input
                          size="sm"
                          type="datetime-local"
                          value={line.expiresAt ?? ""}
                          disabled={disabled || pending !== null}
                          onChange={(event) =>
                            updateLine(index, { expiresAt: event.target.value })
                          }
                        />
                      </Field>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            size="sm"
            disabled={disabled}
            loading={pending === createPendingKey}
            onClick={() => {
              void onCreate(values).then((saved) => {
                if (saved) setValues(EMPTY_MOVEMENT_FORM);
              });
            }}
          >
            <HeaderIcon className="size-4" aria-hidden="true" />
            {createLabel}
          </Button>
        </div>
      </Card>

      {createdId ? (
        <DegradedBanner message={`${t.tradeInventory.lastMovementId}: ${createdId}`} />
      ) : null}

      {/* Stage 2: Post or Reverse Movement Document */}
      <Card className="flex flex-col gap-4 border border-border/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t.tradeInventory.postOrReverse}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.tradeInventory.postOrReverseHint}
            </p>
          </div>
          <Badge tone="brand">
            If-Match v{effectiveVersion}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label={t.tradeInventory.movementId} required>
            <Input
              size="sm"
              placeholder={t.tradeInventory.uuidPlaceholder}
              value={targetId}
              disabled={disabled || pending !== null}
              onChange={(event) => setActionId(event.target.value)}
            />
          </Field>
          <Field label={t.tradeCommon.version} required hint={t.tradeCommon.ifMatchHint}>
            <Input
              size="sm"
              placeholder="1"
              type="number"
              min={1}
              value={effectiveVersion}
              disabled={disabled || pending !== null}
              onChange={(event) => setActionVersion(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.reasonCode} hint={t.tradeInventory.reasonCodeHint}>
            <Input
              size="sm"
              placeholder="DAMAGED_ON_ARRIVAL"
              value={reasonCode}
              disabled={disabled || pending !== null || !canReverse}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.reversalEffectiveAt}>
            <Input
              size="sm"
              placeholder={t.tradeInventory.reversalEffectiveAt}
              type="datetime-local"
              value={reversalAt}
              disabled={disabled || pending !== null || !canReverse}
              onChange={(event) => setReversalAt(event.target.value)}
            />
          </Field>
        </div>

        {/* Reversal Reason Presets */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <span className="text-2xs font-medium text-muted-foreground">
            {isAr
              ? "رموز أسباب العكس المحاسبي (تتطلب صلاحية trade.inventory.adjust):"
              : "Quick Reversal Reason Presets (Requires trade.inventory.adjust):"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REVERSAL_REASON_PRESETS.map((code) => {
              const active = reasonCode.trim() === code;
              return (
                <Button
                  key={code}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || pending !== null || !canReverse}
                  onClick={() => setReasonCode(code)}
                  className={`h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors ${
                    active
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <IdentifierText className="text-2xs">{code}</IdentifierText>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            size="sm"
            disabled={disabled}
            loading={pending === postPendingKey}
            onClick={() => void onPost(targetId, Number(effectiveVersion))}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {postLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canReverse}
            loading={pending === reversePendingKey}
            onClick={() =>
              void onReverse(
                targetId,
                Number(effectiveVersion),
                reasonCode,
                reversalAt,
              )
            }
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {reverseLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

