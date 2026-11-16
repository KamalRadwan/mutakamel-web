"use client";

import { AlertTriangle, Copy, FilePlus2, Layers } from "lucide-react";
import { Badge, Button, Field, FormModal, IdentifierText, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, cn } from "@/design-system";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { CLONE_SOURCE_MODES, PRICE_ADJUSTMENT_MODES, PRICE_BOOK_VERSION_NOTES_MAX_LENGTH, PRICE_ROUNDING_MODES, type PriceAdjustmentMode, type PriceRoundingMode } from "../pricing-contract";
import { useCreateDraftVersionForm, type CreateDraftVersionModalProps } from "./hooks/useCreateDraftVersionForm";
export function CreateDraftVersionModal(props: CreateDraftVersionModalProps) {
  const form = useCreateDraftVersionForm(props);
  const { open, onOpenChange, detail, isSubmitting, error, t, compatibleVersionOptions, hasVersionSources, setSourceMode, setSourceVersionId, effectiveFrom, setEffectiveFrom, effectiveTo, setEffectiveTo, adjustmentMode, setAdjustmentMode, adjustmentValue, setAdjustmentValue, roundingMode, setRoundingMode, copyPromotions, setCopyPromotions, notes, setNotes, effectiveSourceMode, resolvedSourceVersionId, isInvalidAdjustment, submitDisabled, submit } = form;
  const asideSummary = (
    <div className="flex flex-col gap-3 p-4 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t.tradePricing.draftSummaryHeading}</h3>
        <Badge tone="caution">{t.tradePricing.draftWillCreateBadge}</Badge>
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>{t.tradePricing.bookCode}</span>
          <IdentifierText className="text-xs font-medium text-foreground">{detail.book.code}</IdentifierText>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>{t.tradePricing.bookPurpose}</span>
          <span className="font-medium text-foreground">{tradeStatusLabel(t.tradeStatus, detail.book.purpose, t.common.unknownCode)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>{t.tradePricing.currencyCode}</span>
          <IdentifierText className="text-xs font-medium text-foreground">{detail.book.currencyCode}</IdentifierText>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
        <h4 className="font-semibold text-foreground">{t.tradePricing.nextStepsHeading}</h4>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep1Author}</p>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep2Test}</p>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep3Publish}</p>
      </div>
    </div>
  );

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={t.tradePricing.createDraftModalTitle}
      description={t.tradePricing.createDraftModalDesc}
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={submitDisabled}
      error={error ?? undefined}
      asideSlot={asideSummary}
      onSubmit={submit}
      labels={{
        submit: t.tradePricing.createNewDraft,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradePricing.createDraftModalTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {CLONE_SOURCE_MODES.map((mode) => {
            const disabled = mode === "VERSION" && !hasVersionSources;
            const selected = effectiveSourceMode === mode;
            const Icon = mode === "VERSION" ? Copy : mode === "CATALOG" ? Layers : FilePlus2;
            const title = mode === "VERSION" ? t.tradePricing.sourceFromVersionTitle : mode === "CATALOG" ? t.tradePricing.sourceFromCatalogTitle : t.tradePricing.sourceEmptyDraftTitle;
            const desc =
              mode === "VERSION"
                ? (hasVersionSources ? t.tradePricing.sourceFromVersionDesc : t.tradePricing.sourceFromVersionUnavailable)
                : mode === "CATALOG"
                  ? t.tradePricing.sourceFromCatalogDesc
                  : t.tradePricing.sourceEmptyDraftDesc;
            return (
              <Button
                key={mode}
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                aria-pressed={selected}
                onClick={() => setSourceMode(mode)}
                className={cn(
                  "h-auto flex-col items-start justify-start gap-1.5 rounded-lg p-3 text-start whitespace-normal font-normal",
                  selected && "border-primary bg-selected ring-1 ring-primary/30",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {title}
                </span>
                <span className="text-caption text-muted-foreground">{desc}</span>
              </Button>
            );
          })}
        </div>

        {effectiveSourceMode === "CATALOG" ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2.5 text-xs text-warning-subtle-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t.tradePricing.catalogSeedZeroCaution}</span>
          </div>
        ) : null}

        {effectiveSourceMode === "VERSION" ? (
          <Field label={t.tradePricing.sourceVersionLabel} showLabel required>
            <Select value={resolvedSourceVersionId} disabled={isSubmitting} onValueChange={setSourceVersionId}>
              <SelectTrigger size="sm" aria-label={t.tradePricing.sourceVersionLabel}><SelectValue /></SelectTrigger>
              <SelectContent>
                {compatibleVersionOptions.map((opt) => (
                  <SelectItem key={opt.versionId} value={opt.versionId}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.tradePricing.effectiveFrom} showLabel required>
            <Input size="sm" type="datetime-local" dir="ltr" disabled={isSubmitting} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
          <Field label={t.tradePricing.effectiveTo} hint={t.tradePricing.effectiveToHint} error={form.isInvalidDates ? t.tradePricing.formDateInvalid : undefined} showLabel>
            <Input size="sm" type="datetime-local" dir="ltr" disabled={isSubmitting} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </Field>
        </div>

        {effectiveSourceMode !== "EMPTY" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t.tradePricing.adjustmentModeLabel} showLabel>
              <Select value={adjustmentMode} disabled={isSubmitting} onValueChange={(v) => setAdjustmentMode(v as PriceAdjustmentMode)}>
                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICE_ADJUSTMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m === "NONE" ? t.tradePricing.adjustmentNone : m === "PERCENTAGE" ? t.tradePricing.adjustmentPercentage : t.tradePricing.adjustmentFixed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {adjustmentMode !== "NONE" ? (
              <Field label={t.tradePricing.adjustmentValueLabel} showLabel error={isInvalidAdjustment ? t.tradePricing.formAmountInvalid : undefined}>
                <Input size="sm" dir="ltr" inputMode="decimal" disabled={isSubmitting} value={adjustmentValue} onChange={(e) => setAdjustmentValue(e.target.value)} />
              </Field>
            ) : null}
            <Field label={t.tradePricing.roundingModeLabel} showLabel>
              <Select value={roundingMode} disabled={isSubmitting} onValueChange={(v) => setRoundingMode(v as PriceRoundingMode)}>
                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICE_ROUNDING_MODES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "NONE" ? t.tradePricing.roundingNone : r === "NEAREST_1" ? t.tradePricing.roundingNearest1 : r === "NEAREST_0_50" ? t.tradePricing.roundingNearest050 : t.tradePricing.roundingEnd95}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}

        {effectiveSourceMode === "VERSION" ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
            <span className="text-xs font-medium text-foreground">{t.tradePricing.copyPromotionsLabel}</span>
            <Switch checked={copyPromotions} disabled={isSubmitting} onCheckedChange={setCopyPromotions} />
          </div>
        ) : null}

        <Field label={t.tradePricing.versionNotesLabel} showLabel>
          <Textarea rows={2} maxLength={PRICE_BOOK_VERSION_NOTES_MAX_LENGTH} disabled={isSubmitting} placeholder={t.tradePricing.versionNotesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );

}
