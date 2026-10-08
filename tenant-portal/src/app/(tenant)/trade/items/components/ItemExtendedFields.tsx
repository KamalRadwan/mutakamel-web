"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  DegradedBanner,
  Field,
  Input,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ITEM_BARCODE_MAX_LENGTH,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_NOTES_MAX_LENGTH,
  type ItemFormValues,
} from "../item-contract";
import { useItemReferenceData } from "../hooks/useItemReferenceData";

interface ItemExtendedFieldsProps {
  values: ItemFormValues;
  disabled: boolean;
  enabled?: boolean;
  errors?: {
    barcode?: string;
    notes?: string;
    ownerUserId?: string;
    weightKg?: string;
    volumeM3?: string;
    descriptions?: string;
  };
  onChange: (patch: Partial<ItemFormValues>) => void;
}

export function ItemExtendedFields({ values, disabled, enabled = true, errors = {}, onChange }: ItemExtendedFieldsProps) {
  const { t } = useI18n();
  const reference = useItemReferenceData(enabled);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [descriptionsOpen, setDescriptionsOpen] = useState(false);
  const detailsHaveErrors = Boolean(
    errors.barcode || errors.notes || errors.ownerUserId || errors.weightKg || errors.volumeM3,
  );
  const detailsExpanded = detailsOpen || detailsHaveErrors;
  const descriptionsExpanded = descriptionsOpen || Boolean(errors.descriptions);
  const ownerMissing =
    values.ownerUserId && !reference.owners.some((owner) => owner.id === values.ownerUserId);
  const selectedOwner = reference.owners.find((owner) => owner.id === values.ownerUserId);

  return (
    <div className="grid gap-3">
      <Section
        open={detailsExpanded}
        onOpenChange={setDetailsOpen}
        title={t.trade.itemOperationalDetails}
        optionalLabel={t.trade.itemOptional}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.trade.itemBarcode} error={errors.barcode}>
            <Input
              size="md"
              dir="ltr"
              value={values.barcode}
              onChange={(event) => onChange({ barcode: event.target.value })}
              maxLength={ITEM_BARCODE_MAX_LENGTH}
              disabled={disabled}
            />
          </Field>
          <Field label={t.trade.itemOwner} error={errors.ownerUserId}>
            <Combobox
              value={values.ownerUserId || undefined}
              selectedLabel={selectedOwner?.name ?? (ownerMissing ? values.ownerUserId : undefined)}
              onValueChange={(next) => onChange({ ownerUserId: next ?? "" })}
              options={reference.owners.map((owner) => ({ value: owner.id, label: owner.name }))}
              onSearch={reference.search}
              loading={reference.isLoading}
              disabled={disabled}
              size="md"
              placeholder={t.trade.itemOwnerPlaceholder}
              searchPlaceholder={t.trade.itemSearchOwners}
              loadingLabel={t.common.loading}
              emptyLabel={t.trade.itemNoOwnerResults}
              clearLabel={t.trade.itemNoOwner}
            />
          </Field>
          <Field label={t.trade.itemWeightKg} hint={t.trade.itemPositiveDecimal} error={errors.weightKg}>
            <Input
              size="md"
              dir="ltr"
              inputMode="decimal"
              value={values.weightKg}
              onChange={(event) => onChange({ weightKg: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label={t.trade.itemVolumeM3} hint={t.trade.itemPositiveDecimal} error={errors.volumeM3}>
            <Input
              size="md"
              dir="ltr"
              inputMode="decimal"
              value={values.volumeM3}
              onChange={(event) => onChange({ volumeM3: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label={t.trade.itemNotes} error={errors.notes} className="sm:col-span-2">
            <Textarea
              rows={3}
              value={values.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              maxLength={ITEM_NOTES_MAX_LENGTH}
              disabled={disabled}
            />
          </Field>
        </div>
        {reference.error ? <DegradedBanner message={t.trade.itemReferenceDataUnavailable} /> : null}
      </Section>

      <Section
        open={descriptionsExpanded}
        onOpenChange={setDescriptionsOpen}
        title={t.trade.itemDocumentDescriptions}
        optionalLabel={t.trade.itemOptional}
      >
        <p className="text-xs text-muted-foreground">{t.trade.itemDocumentDescriptionsHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DescriptionField
            label={t.trade.itemQuotationDescription}
            value={values.quotationDescription}
            error={errors.descriptions}
            disabled={disabled}
            onChange={(quotationDescription) => onChange({ quotationDescription })}
          />
          <DescriptionField
            label={t.trade.itemSalesOrderDescription}
            value={values.salesOrderDescription}
            disabled={disabled}
            onChange={(salesOrderDescription) => onChange({ salesOrderDescription })}
          />
          <DescriptionField
            label={t.trade.itemReceiptDescription}
            value={values.receiptDescription}
            disabled={disabled}
            onChange={(receiptDescription) => onChange({ receiptDescription })}
          />
          <DescriptionField
            label={t.trade.itemDeliveryDescription}
            value={values.deliveryOrderDescription}
            disabled={disabled}
            onChange={(deliveryOrderDescription) => onChange({ deliveryOrderDescription })}
          />
        </div>
      </Section>
    </div>
  );
}

function DescriptionField({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
      />
    </Field>
  );
}

function Section({
  open,
  onOpenChange,
  title,
  optionalLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  optionalLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="overflow-hidden rounded-md border border-border bg-card">
      <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none px-4 py-2.5 text-start hover:bg-muted/40">
        <span className="flex items-center gap-2">
          <ChevronDown className={open ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{optionalLabel}</span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
