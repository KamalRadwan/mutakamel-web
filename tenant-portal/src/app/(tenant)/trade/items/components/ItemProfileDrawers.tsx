"use client";

import { useState } from "react";
import { Building2, Globe, MapPin } from "lucide-react";
import {
  Badge,
  Combobox,
  DegradedBanner,
  Field,
  FormModal,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  TooltipProvider,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCatalogUoms } from "../hooks/useCatalogUoms";
import { useItemReferenceData } from "../hooks/useItemReferenceData";
import type { CatalogUomPurpose } from "../../uoms/uom-contract";
import { formatTradeDecimal, isItemDecimalString } from "../item-contract";
import type { ItemTaxOption } from "../item-reference-data-contract";
import {
  EMPTY_BRANCH_PROFILE_FORM,
  EMPTY_COMPANY_PROFILE_FORM,
  EMPTY_LISTING_FORM,
  ITEM_TRACKING_MODES,
  PUBLICATION_STATUS_MAX_LENGTH,
  toBranchProfileForm,
  toCompanyProfileForm,
  toListingForm,
  type BranchProfileFormValues,
  type CompanyProfileFormValues,
  type ItemBranchProfile,
  type ItemChannelListing,
  type ItemCompanyProfile,
  type ItemTrackingMode,
  type ListingFormValues,
} from "../item-profile-contract";

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
    sections: t.trade.itemFormSections,
    sectionInvalid: t.trade.itemFormHasErrors,
  };
}

const NO_UOM = "__none__";

/**
 * The default-UOM pickers read `GET /catalog/uoms`, which is the authorised set
 * for the operating context rather than the tenant master. When that read is
 * unavailable — no company selected, or a 403 — the field degrades to the raw
 * id it is really sending, instead of offering an empty list.
 */
function UomField({
  label,
  value,
  purpose,
  isSubmitting,
  onChange,
}: {
  label: string;
  value: string;
  purpose: CatalogUomPurpose;
  isSubmitting: boolean;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  const { options, isLoading, isUnavailable } = useCatalogUoms(purpose, true);

  if (isUnavailable) {
    return (
      <Field label={label} showLabel hint={t.trade.errorMissingCompany} hintPlacement="tooltip">
        <Input
          size="sm"
          placeholder={label}
          dir="ltr"
          className="font-mono"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isSubmitting}
        />
      </Field>
    );
  }

  return (
    <Field label={label} showLabel>
      <Select
        value={value || NO_UOM}
        onValueChange={(next) => onChange(next === NO_UOM ? "" : next)}
        disabled={isSubmitting || isLoading}
      >
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_UOM}>{t.trade.trackingMode_NONE}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.code} — {option.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function TaxField({
  label,
  value,
  taxes,
  loading,
  disabled,
  onSearch,
  onChange,
}: {
  label: string;
  value: string;
  taxes: ItemTaxOption[];
  loading: boolean;
  disabled: boolean;
  onSearch: (query: string) => void;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  const selected = taxes.find((tax) => tax.id === value);
  return (
    <Field label={label} showLabel hint={t.trade.itemTaxStoredById} hintPlacement="tooltip">
      <Combobox
        value={value || undefined}
        selectedLabel={selected ? `${selected.code} — ${selected.name}` : value || undefined}
        onValueChange={(next) => onChange(next ?? "")}
        options={taxes.map((tax) => ({
          value: tax.id,
          label: `${tax.code} — ${tax.name}`,
          description: `${formatTradeDecimal(tax.rate)}%`,
        }))}
        onSearch={onSearch}
        loading={loading}
        disabled={disabled}
        size="sm"
        placeholder={t.trade.itemTaxPlaceholder}
        searchPlaceholder={t.trade.itemSearchTaxes}
        loadingLabel={t.common.loading}
        emptyLabel={t.trade.itemNoTaxResults}
        clearLabel={t.trade.itemNoTax}
      />
    </Field>
  );
}

export function CompanyProfileDrawer({
  open,
  itemKind,
  profile,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  itemKind: string;
  profile: ItemCompanyProfile | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CompanyProfileFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const productInventory = itemKind === "PRODUCT";
  const baseInitial = profile ? toCompanyProfileForm(profile) : EMPTY_COMPANY_PROFILE_FORM;
  const initial = productInventory
    ? baseInitial
    : { ...baseInitial, trackInventory: false, trackingMode: "NONE" as const };
  const [values, setValues] = useState<CompanyProfileFormValues>(initial);
  const reference = useItemReferenceData(open);
  const change = (patch: Partial<CompanyProfileFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const activeCapabilitiesCount = [
    values.canSell,
    values.canPurchase,
    values.canPos,
    values.trackInventory,
  ].filter(Boolean).length;

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.trade.companyProfileTitle}
      // The upsert warning is a permanent property of the route, not a
      // validation message, so it rides in the description rather than the
      // error slot.
      description={t.trade.upsertWarning}
      size="wide"
      headerIcon={
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-info-subtle text-info-subtle-foreground">
          <Building2 className="size-4" aria-hidden />
        </div>
      }
      titleBadge={
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">{t.trade[`itemKind_${itemKind as "PRODUCT" | "SERVICE" | "COMBO"}`] ?? itemKind}</Badge>
          {profile ? (
            <Badge tone="positive">
              <IdentifierText>{`v${profile.version}`}</IdentifierText>
            </Badge>
          ) : null}
        </div>
      }
      bodyClassName="bg-muted/40 p-4 sm:p-5"
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-3">
          {/* Card 1: Commercial Eligibility & Inventory Tracking */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                {t.trade.companyProfileTitle}
              </span>
              <Badge tone={activeCapabilitiesCount > 0 ? "positive" : "neutral"}>
                {`${activeCapabilitiesCount} / 4`}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={`rounded-lg border p-2.5 transition-colors ${
                  values.canSell
                    ? "border-border bg-success-subtle text-success-subtle-foreground"
                    : "border-border bg-muted/30"
                }`}
              >
                <Field label={t.trade.canSell} showLabel>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <Switch
                      checked={values.canSell}
                      onCheckedChange={(checked) =>
                        change({
                          canSell: checked,
                          ...(!checked ? { canPos: false } : {}),
                        })
                      }
                      disabled={isSubmitting}
                    />
                    <span className="text-xs font-medium">
                      {values.canSell ? t.common.active : t.common.inactive}
                    </span>
                  </div>
                </Field>
              </div>

              <div
                className={`rounded-lg border p-2.5 transition-colors ${
                  values.canPurchase
                    ? "border-border bg-success-subtle text-success-subtle-foreground"
                    : "border-border bg-muted/30"
                }`}
              >
                <Field label={t.trade.canPurchase} showLabel>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <Switch
                      checked={values.canPurchase}
                      onCheckedChange={(checked) => change({ canPurchase: checked })}
                      disabled={isSubmitting}
                    />
                    <span className="text-xs font-medium">
                      {values.canPurchase ? t.common.active : t.common.inactive}
                    </span>
                  </div>
                </Field>
              </div>

              <div
                className={`rounded-lg border p-2.5 transition-colors ${
                  values.canPos
                    ? "border-border bg-info-subtle text-info-subtle-foreground"
                    : "border-border bg-muted/30"
                }`}
              >
                <Field label={t.trade.canPos} showLabel hint={t.trade.canPosHint} hintPlacement="tooltip">
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <Switch
                      checked={values.canPos}
                      onCheckedChange={(checked) => change({ canPos: checked })}
                      disabled={isSubmitting || !values.canSell}
                    />
                    <span className="text-xs font-medium">
                      {values.canPos ? t.common.active : t.common.inactive}
                    </span>
                  </div>
                </Field>
              </div>

              <div
                className={`rounded-lg border p-2.5 transition-colors ${
                  values.trackInventory
                    ? "border-border bg-warning-subtle text-warning-subtle-foreground"
                    : "border-border bg-muted/30"
                }`}
              >
                <Field
                  label={t.trade.trackInventory}
                  showLabel
                  hint={!productInventory ? t.trade.itemInventoryProductOnly : undefined}
                  hintPlacement="tooltip"
                >
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <Switch
                      checked={values.trackInventory}
                      onCheckedChange={(checked) =>
                        change({
                          trackInventory: checked,
                          ...(!checked ? { trackingMode: "NONE" } : {}),
                        })
                      }
                      disabled={isSubmitting || !productInventory}
                    />
                    <span className="text-xs font-medium">
                      {values.trackInventory ? t.common.active : t.common.inactive}
                    </span>
                  </div>
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
              <Field
                label={t.trade.trackingMode}
                showLabel
                hint={
                  productInventory && !values.trackInventory
                    ? t.trade.itemTrackingRequiresInventory
                    : undefined
                }
                hintPlacement="tooltip"
                required
              >
                <Select
                  value={values.trackingMode}
                  onValueChange={(next) => change({ trackingMode: next as ItemTrackingMode })}
                  disabled={isSubmitting || !productInventory || !values.trackInventory}
                >
                  <SelectTrigger size="sm" aria-label={t.trade.trackingMode}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TRACKING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {t.trade[`trackingMode_${mode}`]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <UomField
                label={t.trade.defaultSalesUom}
                value={values.defaultSalesUomId}
                purpose="SALES"
                isSubmitting={isSubmitting}
                onChange={(next) => change({ defaultSalesUomId: next })}
              />

              <UomField
                label={t.trade.defaultPurchaseUom}
                value={values.defaultPurchaseUomId}
                purpose="PURCHASE"
                isSubmitting={isSubmitting}
                onChange={(next) => change({ defaultPurchaseUomId: next })}
              />
            </div>
          </div>

          {/* Card 2: Pricing, Taxes & Accounting Keys */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                {t.trade.itemSalesPrice} & {t.trade.taxClassificationKey}
              </span>
              {reference.companyCurrencyCode ? (
                <Badge tone="brand">
                  <IdentifierText>{reference.companyCurrencyCode}</IdentifierText>
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-start">
              <Field
                label={t.trade.itemSalesPrice}
                showLabel
                hint={t.trade.itemNonNegativeDecimal}
                hintPlacement="tooltip"
              >
                <Input
                  size="sm"
                  dir="ltr"
                  className="font-mono tabular-nums"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={values.salesPrice}
                  onChange={(event) =>
                    change({
                      salesPrice: event.target.value,
                      ...(!values.currencyCode && reference.companyCurrencyCode
                        ? { currencyCode: reference.companyCurrencyCode }
                        : {}),
                    })
                  }
                  onBlur={() => {
                    if (values.salesPrice.trim() && isItemDecimalString(values.salesPrice.trim())) {
                      change({ salesPrice: formatTradeDecimal(values.salesPrice) });
                    }
                  }}
                  disabled={isSubmitting}
                />
              </Field>

              <Field
                label={t.trade.itemCurrencyCode}
                showLabel
                hint={t.trade.itemCurrencyHint}
                hintPlacement="tooltip"
              >
                <Input
                  size="sm"
                  dir="ltr"
                  className="font-mono"
                  value={values.currencyCode}
                  placeholder={reference.companyCurrencyCode ?? undefined}
                  onChange={(event) => change({ currencyCode: event.target.value.toUpperCase() })}
                  maxLength={3}
                  disabled={isSubmitting}
                />
              </Field>

              <TaxField
                label={t.trade.itemSalesTax}
                value={values.salesTaxId}
                taxes={reference.taxes}
                loading={reference.isLoading}
                disabled={isSubmitting}
                onSearch={reference.search}
                onChange={(salesTaxId) => change({ salesTaxId })}
              />

              <TaxField
                label={t.trade.itemPurchaseTax}
                value={values.purchaseTaxId}
                taxes={reference.taxes}
                loading={reference.isLoading}
                disabled={isSubmitting}
                onSearch={reference.search}
                onChange={(purchaseTaxId) => change({ purchaseTaxId })}
              />
            </div>

            {reference.error ? <DegradedBanner message={t.trade.itemReferenceDataUnavailable} /> : null}

            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <Field label={t.trade.taxClassificationKey} showLabel>
                <Input
                  size="sm"
                  placeholder={t.trade.taxClassificationKey}
                  value={values.taxClassificationKey}
                  onChange={(event) => change({ taxClassificationKey: event.target.value })}
                  maxLength={80}
                  disabled={isSubmitting}
                />
              </Field>

              <Field label={t.trade.accountingMappingKey} showLabel>
                <Input
                  size="sm"
                  placeholder={t.trade.accountingMappingKey}
                  value={values.accountingMappingKey}
                  onChange={(event) => change({ accountingMappingKey: event.target.value })}
                  maxLength={80}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field
              label={t.trade.capabilitySet}
              showLabel
              hint={t.trade.capabilitySetHint}
              hintPlacement="tooltip"
            >
              <Textarea
                placeholder={t.trade.capabilitySet}
                dir="ltr"
                className="font-mono"
                value={values.capabilitySet}
                onChange={(event) => change({ capabilitySet: event.target.value })}
                disabled={isSubmitting}
              />
            </Field>
          </div>
        </div>
      </TooltipProvider>
    </FormModal>
  );
}

export function BranchProfileDrawer({
  open,
  profile,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  profile: ItemBranchProfile | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: BranchProfileFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = profile ? toBranchProfileForm(profile) : EMPTY_BRANCH_PROFILE_FORM;
  const [values, setValues] = useState<BranchProfileFormValues>(initial);
  const change = (patch: Partial<BranchProfileFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.trade.branchProfileTitle}
      description={t.trade.upsertWarning}
      size="card"
      headerIcon={
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-success-subtle text-success-subtle-foreground">
          <MapPin className="size-4" aria-hidden />
        </div>
      }
      titleBadge={
        <Badge tone={values.isAssorted ? "positive" : "neutral"}>
          {values.isAssorted ? t.common.active : t.common.inactive}
        </Badge>
      }
      bodyClassName="bg-muted/40 p-4 sm:p-5"
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div
            className={`rounded-lg border p-3 transition-colors ${
              values.isAssorted
                ? "border-border bg-success-subtle text-success-subtle-foreground"
                : "border-border bg-muted/30"
            }`}
          >
            <Field label={t.trade.isAssorted} showLabel>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <Switch
                  checked={values.isAssorted}
                  onCheckedChange={(checked) => change({ isAssorted: checked })}
                  disabled={isSubmitting}
                />
                <span className="text-xs font-medium">
                  {values.isAssorted ? t.common.active : t.common.inactive}
                </span>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <Field label={t.trade.defaultFulfillmentNode} showLabel>
              <Input
                size="sm"
                placeholder={t.trade.defaultFulfillmentNode}
                dir="ltr"
                className="font-mono"
                value={values.defaultFulfillmentNodeId}
                onChange={(event) => change({ defaultFulfillmentNodeId: event.target.value })}
                disabled={isSubmitting}
              />
            </Field>

            <Field label={t.trade.replenishmentPolicyKey} showLabel>
              <Input
                size="sm"
                placeholder={t.trade.replenishmentPolicyKey}
                value={values.replenishmentPolicyKey}
                onChange={(event) => change({ replenishmentPolicyKey: event.target.value })}
                maxLength={80}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field
            label={t.trade.restrictions}
            showLabel
            hint={t.trade.restrictionsHint}
            hintPlacement="tooltip"
          >
            <Textarea
              placeholder={t.trade.restrictions}
              dir="ltr"
              className="font-mono"
              value={values.restrictions}
              onChange={(event) => change({ restrictions: event.target.value })}
              disabled={isSubmitting}
            />
          </Field>
        </div>
      </TooltipProvider>
    </FormModal>
  );
}

export function ListingDrawer({
  open,
  listing,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  listing: ItemChannelListing | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ListingFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = listing ? toListingForm(listing) : EMPTY_LISTING_FORM;
  const [values, setValues] = useState<ListingFormValues>(initial);
  const change = (patch: Partial<ListingFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={listing ? t.trade.listingEditTitle : t.trade.listingCreateTitle}
      description={t.trade.upsertWarning}
      size="card"
      headerIcon={
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-info-subtle text-info-subtle-foreground">
          <Globe className="size-4" aria-hidden />
        </div>
      }
      titleBadge={
        values.publicationStatus ? (
          <Badge tone={values.publicationStatus === "PUBLISHED" ? "positive" : "brand"}>
            <IdentifierText>{values.publicationStatus}</IdentifierText>
          </Badge>
        ) : undefined
      }
      bodyClassName="bg-muted/40 p-4 sm:p-5"
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            {/* The channel is part of the PATCH path, not its body, so it is
                information on edit rather than an editable field. */}
            <Field
              label={t.trade.listingChannel}
              showLabel
              readOnly={listing !== null}
              required={listing === null}
            >
              <Input
                size="sm"
                placeholder={t.trade.listingChannel}
                dir="ltr"
                className="font-mono"
                value={values.channelId}
                onChange={(event) => change({ channelId: event.target.value })}
                disabled={isSubmitting}
                readOnly={listing !== null}
                required={listing === null}
              />
            </Field>

            <Field
              label={t.trade.publicationStatus}
              showLabel
              hint={t.trade.publicationStatusHint}
              hintPlacement="tooltip"
            >
              <Input
                size="sm"
                placeholder={t.trade.publicationStatus}
                dir="ltr"
                value={values.publicationStatus}
                onChange={(event) => change({ publicationStatus: event.target.value.toUpperCase() })}
                maxLength={PUBLICATION_STATUS_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field
            label={t.trade.saleConstraints}
            showLabel
            hint={t.trade.saleConstraintsHint}
            hintPlacement="tooltip"
          >
            <Textarea
              placeholder={t.trade.saleConstraints}
              dir="ltr"
              className="font-mono"
              value={values.saleConstraints}
              onChange={(event) => change({ saleConstraints: event.target.value })}
              disabled={isSubmitting}
            />
          </Field>
        </div>
      </TooltipProvider>
    </FormModal>
  );
}
