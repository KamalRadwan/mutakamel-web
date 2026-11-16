"use client";

import { Lock } from "lucide-react";
import { Badge, Field, FormModal, IdentifierText, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { PRICE_BOOK_DESCRIPTION_MAX_LENGTH, PRICE_BOOK_NAME_MAX_LENGTH, PRICE_BOOK_STATUSES, type PriceBookStatus } from "../pricing-contract";
import { useEditPriceBookForm, type EditPriceBookModalProps } from "./hooks/useEditPriceBookForm";
export function EditPriceBookModal(props: EditPriceBookModalProps) {
  const { open, onOpenChange, isSubmitting, error, t, book, nameAr, setNameAr, nameEn, setNameEn, name, setName, description, setDescription, status, setStatus, isDirty, cannotDeactivate, submit } = useEditPriceBookForm(props);
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="card"
      title={t.tradePricing.editBookTitle}
      description={t.tradePricing.editBookDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={!isDirty || cannotDeactivate}
      error={error ?? undefined}
      onSubmit={submit}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradePricing.editBookTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <IdentifierText className="font-semibold text-foreground">{book.code}</IdentifierText>
            <Badge tone="neutral">
              {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
            </Badge>
            <Badge tone="neutral">
              <IdentifierText className="text-badge">{book.currencyCode}</IdentifierText>
            </Badge>
          </div>
          <span className="text-caption text-muted-foreground">
            {t.tradePricing.immutableWarning}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.tradePricing.bookNameAr} showLabel>
            <Input
              size="sm"
              dir="rtl"
              maxLength={PRICE_BOOK_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
          </Field>
          <Field label={t.tradePricing.bookNameEn} showLabel>
            <Input
              size="sm"
              dir="ltr"
              maxLength={PRICE_BOOK_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </Field>
        </div>

        <Field label={t.tradePricing.bookName} showLabel>
          <Input
            size="sm"
            maxLength={PRICE_BOOK_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t.tradePricing.bookDescription} showLabel>
          <Textarea
            rows={2}
            maxLength={PRICE_BOOK_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field
          label={t.common.status}
          showLabel
          hint={book.isCompanyDefault ? t.tradePricing.cannotDeactivateDefault : undefined}
        >
          <Select
            value={status}
            disabled={isSubmitting}
            onValueChange={(next) => setStatus(next as PriceBookStatus)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_BOOK_STATUSES.map((st) => (
                <SelectItem
                  key={st}
                  value={st}
                  disabled={st === "INACTIVE" && book.isCompanyDefault}
                >
                  {tradeStatusLabel(t.tradeStatus, st, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormModal>
  );

}
