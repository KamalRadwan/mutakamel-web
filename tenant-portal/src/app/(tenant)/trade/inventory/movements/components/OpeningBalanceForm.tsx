"use client";

import { useState } from "react";
import { Barcode, Boxes, CheckCircle2, Sparkles, Warehouse } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  Field,
  Input,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUuidV7 } from "../../../trade-advanced-validation";
import type { InventoryNode } from "../../inventory-contract";
import {
  EMPTY_OPENING_BALANCE_FORM,
  type OpeningBalanceFormValues,
} from "../movements-contract";

interface OpeningBalanceFormProps {
  onSubmit: (values: OpeningBalanceFormValues) => Promise<boolean>;
  isPending: boolean;
  disabled: boolean;
  error: string | null;
  knownNodes?: InventoryNode[];
}

export function OpeningBalanceForm({
  onSubmit,
  isPending,
  disabled,
  error,
  knownNodes = [],
}: OpeningBalanceFormProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [values, setValues] = useState<OpeningBalanceFormValues>(EMPTY_OPENING_BALANCE_FORM);
  const [showTracking, setShowTracking] = useState(false);

  const set = (patch: Partial<OpeningBalanceFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const serialCount = (values.serialKeys ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;

  const isReady =
    isUuidV7(values.nodeId) &&
    isUuidV7(values.itemId) &&
    isUuidV7(values.uomId) &&
    values.quantity.trim().length > 0 &&
    Number(values.itemProfileVersion) >= 1 &&
    values.businessEffectiveAt.trim().length > 0;

  return (
    <Card className="flex flex-col gap-4 border border-border/80 p-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-s-4 p-3.5",
          SWATCH_SURFACE_PALETTES.green.sectionCard,
          SWATCH_SURFACE_PALETTES.green.accentBorder,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
            )}
          >
            <Boxes className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t.tradeInventory.openingBalanceTab}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t.tradeInventory.openingBalanceHint}
            </p>
          </div>
        </div>
        <Badge tone={isReady ? "positive" : "caution"}>
          {isReady
            ? isAr
              ? "جاهز للترحيل الفوري"
              : "Ready to Post Opening Balance"
            : isAr
              ? "أكمل الحقول الإلزامية"
              : "Complete Required Fields"}
        </Badge>
      </div>

      {/* Quick-Select Branch Nodes */}
      {knownNodes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
            <Warehouse className="size-3.5" aria-hidden="true" />
            {isAr ? "اختيار عقدة سريع:" : "Quick Node Pick:"}
          </span>
          {knownNodes.slice(0, 8).map((node) => {
            const active = values.nodeId.trim() === node.id;
            return (
              <Button
                key={node.id}
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isPending}
                onClick={() => set({ nodeId: node.id })}
                className={`inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-2xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-mono font-semibold">{node.code}</span>
                <span>({node.name})</span>
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
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ nodeId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.itemId} required>
          <Input
            size="sm"
            value={values.itemId}
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ itemId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.uomId} required>
          <Input
            size="sm"
            value={values.uomId}
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ uomId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.quantity} required hint={t.tradeCommon.decimalHint}>
          <Input
            size="sm"
            placeholder="100"
            value={values.quantity}
            disabled={disabled || isPending}
            inputMode="decimal"
            onChange={(event) => set({ quantity: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.itemProfileVersion} required>
          <Input
            size="sm"
            placeholder="1"
            type="number"
            min={1}
            value={values.itemProfileVersion}
            disabled={disabled || isPending}
            onChange={(event) => set({ itemProfileVersion: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.businessEffectiveAt} required>
          <Input
            size="sm"
            placeholder={t.tradeInventory.businessEffectiveAt}
            type="datetime-local"
            value={values.businessEffectiveAt}
            disabled={disabled || isPending}
            onChange={(event) => set({ businessEffectiveAt: event.target.value })}
          />
        </Field>
      </div>

      {/* Optional Lot / Serial / Expiry Tracking Drawer */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTracking((prev) => !prev)}
            className="inline-flex h-auto items-center gap-1.5 px-1 py-0.5 text-xs font-semibold text-foreground hover:text-primary"
          >
            <Barcode className="size-4 text-primary" aria-hidden="true" />
            <span>
              {isAr
                ? "خيارات تتبع الدفعات والأرقام التسلسلية وتاريخ الصلاحية (اختياري)"
                : "Lot, Serial & Expiry Tracking Options (Optional DTO Fields)"}
            </span>
          </Button>
          <div className="flex items-center gap-1.5">
            {serialCount > 0 ? (
              <Badge tone="brand">
                {serialCount} {isAr ? "رقم تسلسلي" : "serial(s)"}
              </Badge>
            ) : null}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setShowTracking((prev) => !prev)}
            >
              {showTracking
                ? isAr
                  ? "إخفاء"
                  : "Hide"
                : isAr
                  ? "إظهار الحقول"
                  : "Configure Lot / Serials"}
            </Button>
          </div>
        </div>

        {showTracking ? (
          <div className="grid gap-3 pt-1 md:grid-cols-3">
            <Field
              label={isAr ? "معرّف الدفعة (lotKey)" : "Lot Key (lotKey)"}
              hint={isAr ? "للأصناف المتتبعة بالدفعة (1..80 حرفاً)" : "Required if item is lot-tracked (1..80 chars)"}
            >
              <Input
                size="sm"
                placeholder="LOT-2026-A01"
                value={values.lotKey ?? ""}
                disabled={disabled || isPending}
                onChange={(event) => set({ lotKey: event.target.value })}
              />
            </Field>
            <Field
              label={isAr ? "الأرقام التسلسلية (serialKeys)" : "Serial Keys (serialKeys)"}
              hint={
                isAr
                  ? "افصل بين الأرقام بفاصلة أو مسافة؛ يجب أن يطابق العدد الكمية"
                  : "Comma/space separated; count must match integer quantity"
              }
            >
              <Input
                size="sm"
                placeholder="SN-1001, SN-1002, SN-1003"
                value={values.serialKeys ?? ""}
                disabled={disabled || isPending}
                onChange={(event) => set({ serialKeys: event.target.value })}
              />
            </Field>
            <Field
              label={isAr ? "تاريخ انتهاء الصلاحية (expiresAt)" : "Expiration Date (expiresAt)"}
              hint={isAr ? "للأصناف القابلة للتلف" : "ISO timestamp for perishable lots"}
            >
              <Input
                size="sm"
                type="datetime-local"
                value={values.expiresAt ?? ""}
                disabled={disabled || isPending}
                onChange={(event) => set({ expiresAt: event.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Sparkles className="size-3.5 text-positive-600" aria-hidden="true" />
          {isAr
            ? "يُسمح برصيد افتتاحي واحد فقط لكل (عقدة + صنف) في فترة محاسبية مفتوحة."
            : "One opening balance allowed per (nodeId, itemId) within an OPEN inventory period."}
        </span>
        <Button
          size="sm"
          disabled={disabled}
          loading={isPending}
          onClick={() => {
            void onSubmit(values).then((saved) => {
              if (saved) setValues(EMPTY_OPENING_BALANCE_FORM);
            });
          }}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t.tradeInventory.submitOpeningBalance}
        </Button>
      </div>
    </Card>
  );
}

