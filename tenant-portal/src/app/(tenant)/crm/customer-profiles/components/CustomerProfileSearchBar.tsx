"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button, PageActions, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import {
  CUSTOMER_PROFILE_ADVANCED_FIELDS,
  customerProfileSearchCleared,
  customerProfileSearchWithGroups,
  customerProfileSearchWithMode,
  type CustomerProfileAdvancedFieldId,
  type CustomerProfileSearchState,
} from "../customer-profile-search-contract";
import { CustomerProfileBasicSearch } from "./CustomerProfileBasicSearch";

export interface CustomerProfileSearchBarProps {
  value: CustomerProfileSearchState;
  onChange: (next: CustomerProfileSearchState) => void;
  onSubmit: () => void;
  sources: AcquisitionSource[];
  sourcesDegraded?: boolean;
  resetKey: string;
  disabled?: boolean;
}

/** Basic is the default token search; Advanced remains an explicit-submit tree. */
export function CustomerProfileSearchBar({
  value,
  onChange,
  onSubmit,
  sources,
  sourcesDegraded,
  resetKey,
  disabled,
}: CustomerProfileSearchBarProps) {
  const { t } = useI18n();

  return (
    <>
      <PageActions slot="search">
        {value.mode === "basic" && (
          <CustomerProfileBasicSearch
            key={resetKey}
            state={value}
            sources={sources}
            sourcesDegraded={sourcesDegraded}
            disabled={disabled}
            onChange={onChange}
          />
        )}

        <Button
          variant={value.mode === "advanced" ? "secondary" : "outline"}
          size="xs"
          disabled={disabled}
          aria-pressed={value.mode === "advanced"}
          aria-label={t.crmCustomerProfiles.searchMode.advanced}
          title={`${t.crmCustomerProfiles.searchMode.label}: ${t.crmCustomerProfiles.searchMode.advanced}`}
          onClick={() =>
            onChange(
              customerProfileSearchWithMode(
                value,
                value.mode === "advanced" ? "basic" : "advanced",
              ),
            )
          }
        >
          <SlidersHorizontal
            className={iconSize({ size: "sm" })}
            aria-hidden="true"
          />
          {t.crmCustomerProfiles.searchMode.advanced}
        </Button>
      </PageActions>

      {value.mode === "advanced" && (
        <CustomerProfileAdvancedSearch
          state={value}
          sources={sources}
          disabled={disabled}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}

function CustomerProfileAdvancedSearch({
  state,
  sources,
  disabled,
  onChange,
  onSubmit,
}: {
  state: CustomerProfileSearchState;
  sources: AcquisitionSource[];
  disabled?: boolean;
  onChange: (next: CustomerProfileSearchState) => void;
  onSubmit: () => void;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmCustomerProfiles.advancedSearch.fields;
  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const profileTypeLabels: Record<string, string | undefined> =
    t.crmCustomerProfiles.profileTypes;
  const cardColorLabels: Record<string, string | undefined> =
    t.crmLeads.card.colors;
  const fieldLabels: Record<CustomerProfileAdvancedFieldId, string> = {
    id: labels.id,
    source: labels.source,
    profileType: labels.profileType,
    status: labels.status,
    rating: t.crmLeads.card.rating,
    cardColor: t.crmLeads.card.cardColor,
    owner: labels.owner,
    sourceLead: labels.sourceLead,
    description: labels.description,
    createdAt: labels.createdAt,
    updatedAt: labels.updatedAt,
  };

  function enumLabel(
    field: CustomerProfileAdvancedFieldId,
    wireValue: string,
  ): string {
    if (field === "profileType") {
      return profileTypeLabels[wireValue] ?? wireValue;
    }
    if (field === "cardColor") {
      return cardColorLabels[wireValue] ?? wireValue;
    }
    return statusLabels[`CustomerStatus.${wireValue}`] ?? wireValue;
  }

  function catalogueOptions(
    field: CustomerProfileAdvancedFieldId,
  ): readonly CrmSearchCatalogueOption[] {
    if (field !== "source") return [];
    return sources.map((source) => {
      const label = localizedName(source, lang);
      return {
        id: source.id,
        label,
        content: <AcquisitionSourceOption source={source} label={label} />,
      };
    });
  }

  return (
    <CrmAdvancedSearchCard
      fields={CUSTOMER_PROFILE_ADVANCED_FIELDS}
      fieldLabels={fieldLabels}
      enumLabel={enumLabel}
      catalogueOptions={catalogueOptions}
      groups={state.groups}
      onGroupsChange={(next) =>
        onChange(customerProfileSearchWithGroups(state, next))
      }
      onSubmit={onSubmit}
      onReset={() => onChange(customerProfileSearchCleared(state))}
      disabled={disabled}
      requireFieldSelection
    />
  );
}
