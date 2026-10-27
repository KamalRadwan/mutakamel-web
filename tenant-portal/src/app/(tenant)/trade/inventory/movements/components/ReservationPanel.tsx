"use client";

import { useState } from "react";
import { Lock, Unlock, Warehouse } from "lucide-react";
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
import { SerialKeysField } from "./SerialKeysField";
import { useReleaseSerials } from "../hooks/useReleaseSerials";
import { isUuidV7 } from "../../../trade-advanced-validation";
import type { InventoryNode } from "../../inventory-contract";
import {
  EMPTY_RESERVATION_FORM,
  RELEASE_REASON_PRESETS,
  type ReservationFormValues,
} from "../movements-contract";

interface ReservationPanelProps {
  onCreate: (values: ReservationFormValues) => Promise<boolean>;
  onRelease: (
    id: string,
    version: number,
    quantity: string,
    reasonCode: string,
    serialKeys?: string,
  ) => Promise<boolean>;
  createdId: string | undefined;
  pending: string | null;
  disabled: boolean;
  error: string | null;
  knownNodes?: InventoryNode[];
  selectedTargetId?: string;
  selectedTargetVersion?: number;
}

/**
 * A reservation is created here and released by id.
 *
 * There is no `GET /inventory/reservations`, so the id below is the one the
 * create returned in this session. A release of any other reservation needs
 * its id from wherever it was recorded — the portal cannot look one up.
 */
export function ReservationPanel({
  onCreate,
  onRelease,
  createdId,
  pending,
  disabled,
  error,
  knownNodes = [],
  selectedTargetId,
  selectedTargetVersion,
}: ReservationPanelProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [values, setValues] = useState<ReservationFormValues>(EMPTY_RESERVATION_FORM);
  const [releaseId, setReleaseId] = useState("");
  const [releaseVersion, setReleaseVersion] = useState("1");
  const [releaseQuantity, setReleaseQuantity] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const set = (patch: Partial<ReservationFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const effectiveReleaseId = releaseId || selectedTargetId || (createdId ?? "");
  const releaseSerials = useReleaseSerials(effectiveReleaseId);
  const effectiveReleaseVersion =
    releaseVersion !== "1"
      ? releaseVersion
      : selectedTargetVersion
        ? String(selectedTargetVersion)
        : "1";

  const isCreateReady =
    isUuidV7(values.nodeId) &&
    isUuidV7(values.itemId) &&
    isUuidV7(values.uomId) &&
    values.quantity.trim().length > 0 &&
    isUuidV7(values.sourceDocumentId) &&
    isUuidV7(values.sourceLineId);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Stage 1: Create Stock Reservation */}
      <Card className="flex flex-col justify-between gap-4 border border-border/80 p-4">
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-s-4 p-3.5",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
              SWATCH_SURFACE_PALETTES.amber.accentBorder,
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                )}
              >
                <Lock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t.tradeInventory.submitReservation}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "حجز كمية لصالح مستند وسطر مصدر مع التحقق من الرصيد المتاح (ATP)"
                    : "Reserve ATP stock against a source order document & line"}
                </p>
              </div>
            </div>
            <Badge tone={isCreateReady ? "positive" : "caution"}>
              {isCreateReady
                ? isAr
                  ? "جاهز للحجز"
                  : "Ready"
                : isAr
                  ? "أكمل البيانات"
                  : "Incomplete"}
            </Badge>
          </div>

          {knownNodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
                <Warehouse className="size-3.5" aria-hidden="true" />
                {isAr ? "عقدة التنفيذ:" : "Node:"}
              </span>
              {knownNodes.slice(0, 6).map((node) => {
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

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t.tradeInventory.nodeId} required error={error ?? undefined}>
              <Input
                size="sm"
                value={values.nodeId}
                disabled={disabled || pending !== null}
                placeholder={t.tradeInventory.uuidPlaceholder}
                onChange={(event) => set({ nodeId: event.target.value })}
              />
            </Field>
            <Field label={t.tradeInventory.itemId} required>
              <Input
                size="sm"
                placeholder={t.tradeInventory.uuidPlaceholder}
                value={values.itemId}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ itemId: event.target.value })}
              />
            </Field>
            <Field label={t.tradeInventory.uomId} required>
              <Input
                size="sm"
                placeholder={t.tradeInventory.uuidPlaceholder}
                value={values.uomId}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ uomId: event.target.value })}
              />
            </Field>
            <Field label={t.tradeInventory.quantity} required hint={t.tradeCommon.decimalHint}>
              <Input
                size="sm"
                placeholder="25"
                value={values.quantity}
                inputMode="decimal"
                disabled={disabled || pending !== null}
                onChange={(event) => set({ quantity: event.target.value })}
              />
            </Field>
            <Field label={t.tradeInventory.lotKey}>
              <Input size="sm" value={values.lotKey ?? ""} maxLength={120}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ lotKey: event.target.value })} />
            </Field>
            <SerialKeysField value={values.serialKeys ?? ""} quantity={values.quantity}
              disabled={disabled || pending !== null} onChange={(serialKeys) => set({ serialKeys })} />
            <Field label={t.tradeInventory.sourceDocumentId} required>
              <Input
                size="sm"
                placeholder={t.tradeInventory.uuidPlaceholder}
                value={values.sourceDocumentId}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ sourceDocumentId: event.target.value })}
              />
            </Field>
            <Field label={t.tradeInventory.sourceLineId} required>
              <Input
                size="sm"
                placeholder={t.tradeInventory.uuidPlaceholder}
                value={values.sourceLineId}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ sourceLineId: event.target.value })}
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
            <Field label={t.tradeInventory.sourceLineVersion} required>
              <Input
                size="sm"
                placeholder="1"
                type="number"
                min={1}
                value={values.sourceLineVersion}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ sourceLineVersion: event.target.value })}
              />
            </Field>
            <Field
              label={isAr ? "تاريخ انتهاء الحجز (expiresAt - اختياري)" : "Reservation Expiry (expiresAt - Optional)"}
              className="md:col-span-2"
            >
              <Input
                size="sm"
                type="datetime-local"
                value={values.expiresAt ?? ""}
                disabled={disabled || pending !== null}
                onChange={(event) => set({ expiresAt: event.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            size="sm"
            disabled={disabled}
            loading={pending === "reservation"}
            onClick={() => {
              void onCreate(values).then((saved) => {
                if (saved) setValues(EMPTY_RESERVATION_FORM);
              });
            }}
          >
            <Lock className="size-4" aria-hidden="true" />
            {t.tradeInventory.submitReservation}
          </Button>
        </div>
      </Card>

      {/* Stage 2: Release Stock Reservation */}
      <Card className="flex flex-col justify-between gap-4 border border-border/80 p-4">
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-s-4 p-3.5",
              SWATCH_SURFACE_PALETTES.teal.sectionCard,
              SWATCH_SURFACE_PALETTES.teal.accentBorder,
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
                )}
              >
                <Unlock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t.tradeInventory.releaseTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.tradeInventory.releaseHint}
                </p>
              </div>
            </div>
            <Badge tone="brand">
              If-Match v{effectiveReleaseVersion}
            </Badge>
          </div>

          {createdId ? (
            <DegradedBanner message={`${t.tradeInventory.lastReservationId}: ${createdId}`} />
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t.tradeInventory.reservationId} required>
              <Input
                size="sm"
                placeholder={t.tradeInventory.uuidPlaceholder}
                value={effectiveReleaseId}
                disabled={disabled || pending !== null}
                onChange={(event) => setReleaseId(event.target.value)}
              />
            </Field>
            <Field label={t.tradeCommon.version} required hint={t.tradeCommon.ifMatchHint}>
              <Input
                size="sm"
                placeholder="1"
                type="number"
                min={1}
                value={effectiveReleaseVersion}
                disabled={disabled || pending !== null}
                onChange={(event) => setReleaseVersion(event.target.value)}
              />
            </Field>
            <Field label={t.tradeInventory.quantity} hint={t.tradeInventory.releaseQuantityHint}>
              <Input
                size="sm"
                placeholder={isAr ? "اتركه فارغاً للإفراج الكامل" : "Leave empty for full release"}
                value={releaseQuantity}
                inputMode="decimal"
                disabled={disabled || pending !== null}
                onChange={(event) => setReleaseQuantity(event.target.value)}
              />
            </Field>
            <SerialKeysField value={releaseSerials.value} quantity={releaseQuantity} subset
              disabled={disabled || pending !== null} onChange={releaseSerials.change} />
            <Field label={t.tradeInventory.reasonCode} hint={t.tradeInventory.reasonCodeHint}>
              <Input
                size="sm"
                placeholder="ORDER_CANCELLED"
                value={releaseReason}
                disabled={disabled || pending !== null}
                onChange={(event) => setReleaseReason(event.target.value)}
              />
            </Field>
          </div>

          {/* Preset Reason Code Chips */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <span className="text-2xs font-medium text-muted-foreground">
              {isAr ? "رموز أسباب الإفراج السريعة:" : "Quick Release Reason Presets:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RELEASE_REASON_PRESETS.map((code) => {
                const active = releaseReason.trim() === code;
                return (
                  <Button
                    key={code}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || pending !== null}
                    onClick={() => setReleaseReason(code)}
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
        </div>

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            loading={pending === "release"}
            onClick={() =>
              void onRelease(
                effectiveReleaseId,
                Number(effectiveReleaseVersion),
                releaseQuantity,
                releaseReason,
                releaseSerials.value,
              ).then((saved) => { if (saved) releaseSerials.change(""); })
            }
          >
            <Unlock className="size-4" aria-hidden="true" />
            {t.tradeInventory.submitRelease}
          </Button>
        </div>
      </Card>
    </div>
  );
}

