"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCatalogUoms } from "../hooks/useCatalogUoms";
import type { CatalogUomPurpose } from "../../uoms/uom-contract";
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
      <Field label={label} hint={t.trade.errorMissingCompany}>
        <Input
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
    <Field label={label}>
      <Select
        value={value || NO_UOM}
        onValueChange={(next) => onChange(next === NO_UOM ? "" : next)}
        disabled={isSubmitting || isLoading}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_UOM}>{t.trade.statusAny}</SelectItem>
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

export function CompanyProfileDrawer({
  open,
  profile,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  profile: ItemCompanyProfile | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CompanyProfileFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = profile ? toCompanyProfileForm(profile) : EMPTY_COMPANY_PROFILE_FORM;
  const [values, setValues] = useState<CompanyProfileFormValues>(initial);
  const change = (patch: Partial<CompanyProfileFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.trade.companyProfileTitle}
      // The upsert warning is a permanent property of the route, not a
      // validation message, so it rides in the description rather than the
      // error slot.
      description={t.trade.upsertWarning}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.trade.canSell}>
          <Switch
            checked={values.canSell}
            onCheckedChange={(checked) => change({ canSell: checked })}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.canPurchase}>
          <Switch
            checked={values.canPurchase}
            onCheckedChange={(checked) => change({ canPurchase: checked })}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.trackInventory}>
          <Switch
            checked={values.trackInventory}
            onCheckedChange={(checked) => change({ trackInventory: checked })}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.trackingMode} required>
          <Select
            value={values.trackingMode}
            onValueChange={(next) => change({ trackingMode: next as ItemTrackingMode })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.trade.trackingMode}>
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
        <Field label={t.trade.taxClassificationKey}>
          <Input
            value={values.taxClassificationKey}
            onChange={(event) => change({ taxClassificationKey: event.target.value })}
            maxLength={80}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.accountingMappingKey}>
          <Input
            value={values.accountingMappingKey}
            onChange={(event) => change({ accountingMappingKey: event.target.value })}
            maxLength={80}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.capabilitySet} hint={t.trade.capabilitySetHint}>
          <Textarea
            dir="ltr"
            className="font-mono"
            value={values.capabilitySet}
            onChange={(event) => change({ capabilitySet: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
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
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.trade.branchProfileTitle}
      description={t.trade.upsertWarning}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.trade.isAssorted}>
          <Switch
            checked={values.isAssorted}
            onCheckedChange={(checked) => change({ isAssorted: checked })}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.defaultFulfillmentNode}>
          <Input
            dir="ltr"
            className="font-mono"
            value={values.defaultFulfillmentNodeId}
            onChange={(event) => change({ defaultFulfillmentNodeId: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.replenishmentPolicyKey}>
          <Input
            value={values.replenishmentPolicyKey}
            onChange={(event) => change({ replenishmentPolicyKey: event.target.value })}
            maxLength={80}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.restrictions} hint={t.trade.restrictionsHint}>
          <Textarea
            dir="ltr"
            className="font-mono"
            value={values.restrictions}
            onChange={(event) => change({ restrictions: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
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
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={listing ? t.trade.listingEditTitle : t.trade.listingCreateTitle}
      description={t.trade.upsertWarning}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        {/* The channel is part of the PATCH path, not its body, so it is
            information on edit rather than an editable field. */}
        <Field label={t.trade.listingChannel} readOnly={listing !== null} required={listing === null}>
          <Input
            dir="ltr"
            className="font-mono"
            value={values.channelId}
            onChange={(event) => change({ channelId: event.target.value })}
            disabled={isSubmitting}
            readOnly={listing !== null}
            required={listing === null}
          />
        </Field>
        <Field label={t.trade.publicationStatus} hint={t.trade.publicationStatusHint}>
          <Input
            dir="ltr"
            value={values.publicationStatus}
            onChange={(event) => change({ publicationStatus: event.target.value.toUpperCase() })}
            maxLength={PUBLICATION_STATUS_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
        <Field label={t.trade.saleConstraints} hint={t.trade.saleConstraintsHint}>
          <Textarea
            dir="ltr"
            className="font-mono"
            value={values.saleConstraints}
            onChange={(event) => change({ saleConstraints: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
