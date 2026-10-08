"use client";

import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  Input,
  cn,
} from "@/design-system";
import { AddressPlaceFields } from "@/components/address/AddressPlaceFields";
import { useI18n } from "@/i18n/I18nContext";
import { LEAD_CREATE_LIMITS, type LeadAddressForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";

export interface LeadAddressSectionProps {
  address: LeadAddressForm;
  errors: LeadCreateErrors;
  disabled: boolean;
  defaultOpen?: boolean;
  onChange: (key: keyof LeadAddressForm, value: string) => void;
  onBlur: (path: string) => void;
}

/**
 * The lead's `LEGAL` primary address on its Party.
 *
 * The DTO also accepts `area`, `street` and `apartment`, and none of them is
 * offered: `leadPartyAddresses` maps `state -> area`, `street1 -> street` and
 * `street2 -> apartment`, with the modern spelling winning. Rendering both
 * would be two boxes writing one column, one of which silently loses.
 *
 * A block where every box is blank sends no address at all, so there is
 * nothing to opt out of.
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

  const hasErrors = Object.keys(errors).some((key) => key.startsWith("address."));
  const [open, setOpen] = useState(defaultOpen);
  const sectionOpen = open || hasErrors;

  // Country, state and city are not in this list: they are one cascading
  // catalogue rather than three free lines, and `AddressPlaceFields` renders
  // them above.
  const rows: Array<{ key: keyof LeadAddressForm; label: string; max: number }> = [
    { key: "street1", label: t.crmLeads.create.street1, max: limits.addressLong },
    { key: "street2", label: t.crmLeads.create.street2, max: limits.addressShort },
    { key: "landmark", label: t.crmLeads.create.landmark, max: limits.addressLong },
    { key: "buildingNo", label: t.crmLeads.create.buildingNo, max: limits.addressShort },
    { key: "floor", label: t.crmLeads.create.floor, max: limits.addressShort },
    { key: "apartment", label: t.crmLeads.create.apartment, max: limits.addressShort },
    { key: "postalCode", label: t.crmLeads.create.postalCode, max: limits.postalCode },
  ];

  return (
    <Collapsible
      open={sectionOpen}
      onOpenChange={(next) => setOpen(hasErrors ? true : next)}
      data-form-section="address"
      className="scroll-mt-4 overflow-hidden rounded-lg border border-border bg-card"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          tabIndex={0}
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-between rounded-none px-3 py-2 text-start font-normal"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4
                  className="truncate text-sm font-semibold leading-tight text-foreground outline-none"
                >
                  {t.crmLeads.create.sections.address}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  · {t.crmLeads.create.optionalBadge}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs leading-normal text-muted-foreground">
                {t.crmLeads.create.addressCollapsibleSubtitle}
              </p>
            </div>
          </div>

          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 rtl:-scale-x-100",
              sectionOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AddressPlaceFields
            values={{ country: address.country, state: address.state, city: address.city }}
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
              // Written key by key rather than spread, because the form's own
              // setter takes one field at a time and its updater is functional —
              // the three writes still land in a single render.
              if (patch.country !== undefined) onChange("country", patch.country);
              if (patch.state !== undefined) onChange("state", patch.state);
              if (patch.city !== undefined) onChange("city", patch.city);
            }}
            onBlur={onBlur}
          />

          {rows.map((row) => (
            <Field key={row.key} label={row.label} error={errors[`address.${row.key}`]} showLabel>
              <Input
                size="sm"
                placeholder={row.label}
                value={address[row.key]}
                maxLength={row.max}
                disabled={disabled}
                onChange={(event) => onChange(row.key, event.target.value)}
                onBlur={() => onBlur(`address.${row.key}`)}
              />
            </Field>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
