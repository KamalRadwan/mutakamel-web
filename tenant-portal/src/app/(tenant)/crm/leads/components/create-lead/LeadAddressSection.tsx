"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { AddressPlaceFields } from "@/components/address/AddressPlaceFields";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  Input,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import { LEAD_CREATE_LIMITS, type LeadAddressForm } from "../../lead-create-contract";
import { LeadFieldGuide } from "./LeadFieldGuide";

interface LeadAddressSectionProps {
  address: LeadAddressForm;
  errors: CrmFormErrors;
  disabled: boolean;
  defaultOpen?: boolean;
  onChange: <K extends keyof LeadAddressForm>(
    key: K,
    value: LeadAddressForm[K],
  ) => void;
  onBlur: (path: string) => void;
}

/**
 * Section 03 — National & Physical Address Details (Amber Theme).
 *
 * Collapsible card with cascading Country → State/Region → City selectors
 * (`AddressPlaceFields`) and a compact 12-column grid for Street 1, Street 2,
 * Building No., Floor, Landmark, and Postal Code.
 */
export function LeadAddressSection({
  address,
  errors,
  disabled,
  defaultOpen = true,
  onChange,
  onBlur,
}: LeadAddressSectionProps) {
  const { t } = useI18n();
  const limits = LEAD_CREATE_LIMITS;
  const [open, setOpen] = useState(defaultOpen);

  const hasAddressError = Object.keys(errors).some(
    (key) => key === "address" || key.startsWith("address."),
  );
  const isOpen = open || hasAddressError;

  return (
    <section
      data-form-section="address"
      className="relative overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors"
    >
      {/* Top 3px accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-primary"
      />

      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={0}
            className="flex h-auto w-full cursor-pointer items-center justify-between gap-3 rounded-none border-b border-border/60 bg-muted/20 px-4 py-3 text-start transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-foreground">
                <MapPin className="size-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t.crmLeads.create.sections.address}
                  </span>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t.crmLeads.create.optionalBadge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.crmLeads.create.addressCollapsibleSubtitle}
                </p>
              </div>
            </div>

            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 p-4">
            {/* Cascading Country → State → City with Field Guides */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.crmLeads.create.country} → {t.crmLeads.create.state} →{" "}
                  {t.crmLeads.create.city}
                </span>
                <div className="flex items-center gap-1.5">
                  <LeadFieldGuide field="country" />
                  <LeadFieldGuide field="state" />
                  <LeadFieldGuide field="city" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <AddressPlaceFields
                  values={{
                    country: address.country,
                    state: address.state,
                    city: address.city,
                  }}
                  labels={{
                    country: t.crmLeads.create.country,
                    state: t.crmLeads.create.state,
                    city: t.crmLeads.create.city,
                  }}
                  errors={errors}
                  errorPrefix="address"
                  maxLength={limits.addressMedium}
                  disabled={disabled}
                  showLabel
                  onChange={(patch) => {
                    if (patch.country !== undefined)
                      onChange("country", patch.country);
                    if (patch.state !== undefined)
                      onChange("state", patch.state);
                    if (patch.city !== undefined) onChange("city", patch.city);
                  }}
                  onBlur={onBlur}
                />
              </div>
            </div>

            {/* Detailed Street & Building 12-Col Grid */}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
              {/* Street 1 (6 cols) */}
              <div className="relative md:col-span-6">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {address.street1.length}/{limits.addressLong}
                  </span>
                  <LeadFieldGuide field="street1" />
                </div>
                <Field
                  label={t.crmLeads.create.street1}
                  error={errors["address.street1"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.street1}
                    value={address.street1}
                    maxLength={limits.addressLong}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange("street1", event.target.value)
                    }
                    onBlur={() => onBlur("address.street1")}
                  />
                </Field>
              </div>

              {/* Street 2 (6 cols) */}
              <div className="relative md:col-span-6">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {address.street2.length}/{limits.addressLong}
                  </span>
                  <LeadFieldGuide field="street2" />
                </div>
                <Field
                  label={t.crmLeads.create.street2}
                  error={errors["address.street2"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.street2}
                    value={address.street2}
                    maxLength={limits.addressLong}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange("street2", event.target.value)
                    }
                    onBlur={() => onBlur("address.street2")}
                  />
                </Field>
              </div>

              {/* Building No (4 cols) */}
              <div className="relative md:col-span-4">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <LeadFieldGuide field="buildingNo" />
                </div>
                <Field
                  label={t.crmLeads.create.buildingNo}
                  error={errors["address.buildingNo"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.buildingNo}
                    value={address.buildingNo}
                    maxLength={limits.addressShort}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange("buildingNo", event.target.value)
                    }
                    onBlur={() => onBlur("address.buildingNo")}
                  />
                </Field>
              </div>

              {/* Floor (4 cols) */}
              <div className="relative md:col-span-4">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <LeadFieldGuide field="floor" />
                </div>
                <Field
                  label={t.crmLeads.create.floor}
                  error={errors["address.floor"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.floor}
                    value={address.floor}
                    maxLength={limits.addressShort}
                    disabled={disabled}
                    onChange={(event) => onChange("floor", event.target.value)}
                    onBlur={() => onBlur("address.floor")}
                  />
                </Field>
              </div>

              {/* Landmark (8 cols) */}
              <div className="relative md:col-span-8">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {address.landmark.length}/{limits.addressLong}
                  </span>
                  <LeadFieldGuide field="landmark" />
                </div>
                <Field
                  label={t.crmLeads.create.landmark}
                  error={errors["address.landmark"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.landmark}
                    value={address.landmark}
                    maxLength={limits.addressLong}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange("landmark", event.target.value)
                    }
                    onBlur={() => onBlur("address.landmark")}
                  />
                </Field>
              </div>

              {/* Postal Code (4 cols) */}
              <div className="relative md:col-span-4">
                <div className="absolute end-0 top-0 flex items-center gap-1">
                  <LeadFieldGuide field="postalCode" />
                </div>
                <Field
                  label={t.crmLeads.create.postalCode}
                  error={errors["address.postalCode"]}
                  showLabel
                >
                  <Input
                    size="sm"
                    dir="ltr"
                    placeholder={t.crmLeads.create.postalCode}
                    value={address.postalCode}
                    maxLength={limits.postalCode}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange("postalCode", event.target.value)
                    }
                    onBlur={() => onBlur("address.postalCode")}
                  />
                </Field>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
