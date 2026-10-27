"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Field,
  FormModal,
  Input,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { INVENTORY_GOVERNANCE_PERMISSION } from "../../inventory-contract";
import {
  computePeriodDays,
  EMPTY_PERIOD_FORM,
  PERIOD_BACKDATE_PRESETS,
  type PeriodFormValues,
} from "../../inventory-governance-contract";

interface CreatePeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PeriodFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

const CODE_TEMPLATES = ["FY2026-M10", "FY2026-M11", "FY2026-M12", "FY2026-Q4"] as const;

export function CreatePeriodModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreatePeriodModalProps) {
  const { t, lang } = useI18n();
  const [values, setValues] = useState<PeriodFormValues>(EMPTY_PERIOD_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_PERIOD_FORM);
  const durationDays = computePeriodDays(values.startsOn, values.endsOn);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_PERIOD_FORM);
          onClose();
        }
      }}
      size="wide"
      title={t.tradeInventory.periodCreateTitle}
      description={t.tradeInventory.periodCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
          )}
        >
          <CalendarRange className="size-4" aria-hidden="true" />
        </div>
      }
      headerAside={
        durationDays !== null ? (
          <Badge tone="positive">
            {`${formatNumber(durationDays, lang)}d`}
          </Badge>
        ) : (
          <Badge tone="brand">OPEN</Badge>
        )
      }
      footerLeading={
        <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
          COMPANY • {INVENTORY_GOVERNANCE_PERMISSION}
        </span>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() =>
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_PERIOD_FORM);
        })
      }
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradeInventory.periodCreateTitle,
        sectionInvalid: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Field
              label={t.tradeInventory.periodCode}
              required
              hint={t.tradeInventory.codePatternHint}
            >
              <Input
                size="sm"
                placeholder={t.tradeInventory.periodCode}
                value={values.code}
                disabled={isSubmitting}
                onChange={(event) =>
                  setValues((current) => ({ ...current, code: event.target.value }))
                }
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {CODE_TEMPLATES.map((tpl) => (
                <Button
                  key={tpl}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((current) => ({ ...current, code: tpl }))
                  }
                  className={cn(
                    "h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors",
                    values.code.trim().toUpperCase() === tpl
                      ? SWATCH_SURFACE_PALETTES.indigo.pillActive
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {tpl}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Field
              label={t.tradeInventory.periodMaxBackdateDays}
              required
              hint={t.tradeInventory.periodMaxBackdateHint}
            >
              <Input
                size="sm"
                placeholder={t.tradeInventory.periodMaxBackdateDays}
                type="number"
                min={0}
                max={366}
                value={values.maxBackdateDays}
                disabled={isSubmitting}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    maxBackdateDays: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {PERIOD_BACKDATE_PRESETS.map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      maxBackdateDays: String(days),
                    }))
                  }
                  className={cn(
                    "h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors",
                    values.maxBackdateDays.trim() === String(days)
                      ? SWATCH_SURFACE_PALETTES.green.pillActive
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {`${days}d`}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t.tradeInventory.periodStartsOn}
            required
            hint={t.tradeInventory.plainDateHint}
          >
            <Input
              size="sm"
              placeholder={t.tradeInventory.periodStartsOn}
              type="date"
              value={values.startsOn}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  startsOn: event.target.value,
                }))
              }
            />
          </Field>
          <Field
            label={t.tradeInventory.periodEndsOn}
            required
            hint={t.tradeInventory.plainDateHint}
          >
            <Input
              size="sm"
              placeholder={t.tradeInventory.periodEndsOn}
              type="date"
              value={values.endsOn}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  endsOn: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        {durationDays !== null ? (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.green.sectionCard,
            )}
          >
            <span className="font-semibold text-foreground">
              {values.code.trim().toUpperCase() || t.tradeInventory.periodCode}:{" "}
              {values.startsOn} → {values.endsOn}
            </span>
            <Badge tone="positive">
              {`${formatNumber(durationDays, lang)}d • maxBackdateDays=${values.maxBackdateDays}`}
            </Badge>
          </div>
        ) : null}
      </div>
    </FormModal>
  );
}
