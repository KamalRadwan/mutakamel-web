"use client";

import { Check, Plus, Star } from "lucide-react";
import { Badge, Button, Checkbox, Field, FormModal, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { PRICE_BOOK_CODE_MAX_LENGTH, PRICE_BOOK_PURPOSES, type PriceBook, type PriceBookFormValues, type PriceBookPurpose } from "../pricing-contract";
import { useCreatePriceBookForm } from "../hooks/useCreatePriceBookForm";
import { PriceBookCurrencyField } from "./PriceBookCurrencyField";
import { PriceBookSeedFields } from "./PriceBookSeedFields";

interface CreatePriceBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PriceBookFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  existingBooks?: PriceBook[];
  canManageDefaults?: boolean;
  initialPurpose?: PriceBookPurpose;
  initialCurrencyCode?: string;
  initialSetDefault?: boolean;
}

export function CreatePriceBookModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  existingBooks = [],
  canManageDefaults = false,
  initialPurpose,
  initialCurrencyCode,
  initialSetDefault = false,
}: CreatePriceBookModalProps) {
  const { t } = useI18n();
  const form = useCreatePriceBookForm({
    isOpen, initialPurpose, initialCurrencyCode, initialSetDefault,
    existingBooks, onSubmit, onClose,
  });
  const { values, setValues } = form;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={form.onOpenChange}
      size="wide"
      title={t.tradePricing.bookCreateTitle}
      description={t.tradePricing.bookCreateDescription}
      titleBadge={
        <Badge tone="brand">
          {tradeStatusLabel(t.tradeStatus, values.purpose, t.common.unknownCode)}
        </Badge>
      }
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={form.submit}
      submitDisabled={form.submitDisabled}
      error={error ?? undefined}
      submitIcon={<Plus className="size-3.5" aria-hidden="true" />}
      footerLeading={
        <span className="truncate text-caption text-muted-foreground">
          {values.seedMode === "CATALOG"
            ? t.tradePricing.seedModeCatalogDesc
            : values.seedMode === "CLONE"
              ? t.tradePricing.seedModeCloneDesc
              : t.tradePricing.seedModeEmptyDesc}
        </span>
      }
      labels={{
        submit: t.tradePricing.bookCreate,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradePricing.bookCreateTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label={t.tradePricing.bookCode}
            hint={t.tradePricing.guideBookCode}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              dir="ltr"
              className="font-mono font-semibold"
              placeholder={t.tradePricing.bookCode}
              value={values.code}
              maxLength={PRICE_BOOK_CODE_MAX_LENGTH}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, code: event.target.value }))
              }
            />
          </Field>

          <Field label={t.tradePricing.bookNameAr} showLabel required>
            <Input
              size="sm"
              placeholder={t.tradePricing.bookNameAr}
              value={values.nameAr ?? ""}
              maxLength={160}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, nameAr: event.target.value }))
              }
            />
          </Field>

          <Field label={t.tradePricing.bookNameEn} showLabel>
            <Input
              size="sm"
              dir="ltr"
              placeholder={t.tradePricing.bookNameEn}
              value={values.nameEn ?? ""}
              maxLength={160}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, nameEn: event.target.value }))
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {`${t.tradePricing.bookPurpose} *`}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_BOOK_PURPOSES.map((purposeValue) => {
                const isSelected = values.purpose === purposeValue;
                return (
                  <Button
                    key={purposeValue}
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        purpose: purposeValue,
                        sourceBookId: "",
                        sourceVersionId: "",
                      }))
                    }
                    className={cn(
                      "justify-between rounded-lg border px-3 font-semibold",
                      isSelected
                        ? "border-primary bg-kpi-new-surface text-kpi-new-text"
                        : "border-line-card bg-card text-foreground-secondary",
                    )}
                  >
                    <span>
                      {tradeStatusLabel(t.tradeStatus, purposeValue, t.common.unknownCode)}
                    </span>
                    {isSelected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  </Button>
                );
              })}
            </div>
          </div>

          <PriceBookCurrencyField form={form} disabled={isSubmitting} />
        </div>

        <PriceBookSeedFields values={values} setValues={setValues}
          compatibleSourceBooks={form.compatibleSourceBooks}
          selectedSourceBook={form.selectedSourceBook} isSubmitting={isSubmitting} />

        {canManageDefaults ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line-card bg-card px-3 py-2.5 text-xs font-semibold text-foreground">
            <Checkbox
              checked={Boolean(values.setAsCompanyDefault)}
              disabled={isSubmitting}
              onCheckedChange={(checked) =>
                setValues((curr) => ({
                  ...curr,
                  setAsCompanyDefault: checked === true,
                }))
              }
            />
            <Star
              className="size-4 shrink-0 fill-star-filled text-star-filled"
              aria-hidden="true"
            />
            <span>{t.tradePricing.setDefaultAfterCreate}</span>
          </label>
        ) : null}
      </div>
    </FormModal>
  );
}
