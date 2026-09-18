"use client";

import { useState } from "react";
import type { FilterSearchOption, FilterSearchToken } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import {
  CUSTOMER_PROFILE_SEARCH_FIELDS,
  EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH,
  addCustomerProfileBasicFilter,
  customerProfileBasicFilterId,
  customerProfileSearchField,
  removeCustomerProfileBasicFilter,
  type CustomerProfileBasicSearch,
  type CustomerProfileSearchFieldId,
} from "../customer-profile-basic-search-contract";
import type { CustomerProfileSearchState } from "../customer-profile-search-contract";

export interface CustomerProfileBasicSearchProps {
  state: CustomerProfileSearchState;
  sources: AcquisitionSource[];
  sourcesDegraded?: boolean;
  disabled?: boolean;
  onChange: (next: CustomerProfileSearchState) => void;
}

export function useCustomerProfileBasicSearch({
  state,
  sources,
  sourcesDegraded,
  onChange,
}: CustomerProfileBasicSearchProps) {
  const { t, lang } = useI18n();
  const labels = t.crmCustomerProfiles.basicSearch;
  const [query, setQuery] = useState("");
  const [field, setField] = useState<CustomerProfileSearchFieldId | null>(null);
  const fieldLabels: Record<CustomerProfileSearchFieldId, string> = {
    customer: labels.fields.customer,
    email: labels.fields.email,
    phone: labels.fields.phone,
    status: labels.fields.status,
    profileType: labels.fields.profileType,
    source: labels.fields.source,
  };
  const term = query.trim();
  const matches = (value: string) =>
    value.toLocaleLowerCase(lang).includes(term.toLocaleLowerCase(lang));

  function valuesFor(id: CustomerProfileSearchFieldId): FilterSearchOption[] {
    if (id === "source") {
      return sources.map((source) => ({
        id: source.id,
        label: localizedName(source, lang),
      }));
    }
    const statuses: Record<string, string | undefined> = t.statusValues;
    const profileTypes: Record<string, string | undefined> =
      t.crmCustomerProfiles.profileTypes;
    return (customerProfileSearchField(id).values ?? []).map((value) => ({
      id: value,
      label:
        (id === "profileType"
          ? profileTypes[value]
          : statuses[`CustomerStatus.${value}`]) ?? labels.valueUnavailable,
    }));
  }

  const tokens: FilterSearchToken[] = [
    ...(state.basic.myCustomers
      ? [
          {
            id: "my-customers",
            label: labels.myCustomers,
            kind: "filter" as const,
          },
        ]
      : []),
    ...state.basic.filters.map((filter) => ({
      id: customerProfileBasicFilterId(filter),
      label: fieldLabels[filter.field],
      kind: "field" as const,
      value:
        customerProfileSearchField(filter.field).kind === "text"
          ? filter.value
          : (valuesFor(filter.field).find((entry) => entry.id === filter.value)
              ?.label ?? labels.valueUnavailable),
    })),
  ];

  function suggestion(
    id: CustomerProfileSearchFieldId,
    expandable: boolean,
  ): FilterSearchOption {
    const currentText = state.basic.filters.find(
      (filter) => customerProfileSearchField(filter.field).kind === "text",
    )?.value;
    return {
      id,
      label: term ? labels.searchFor(fieldLabels[id], term) : fieldLabels[id],
      expandable,
      ...(term
        ? {
            search: {
              prefix: labels.searchPrefix,
              field: fieldLabels[id],
              connector: labels.searchConnector,
              value: term,
            },
          }
        : {}),
      description:
        customerProfileSearchField(id).kind === "text" &&
        currentText &&
        currentText !== term
          ? labels.replaceTextHint
          : undefined,
    };
  }

  let options: FilterSearchOption[];
  if (field && customerProfileSearchField(field).kind === "text") {
    options = term ? [{ ...suggestion(field, false), id: `${field}-value` }] : [];
  } else if (field) {
    options = valuesFor(field).filter(
      (entry) =>
        matches(entry.label) &&
        !state.basic.filters.some(
          (filter) => filter.field === field && filter.value === entry.id,
        ),
    );
  } else {
    options = [
      ...(!state.basic.myCustomers && (!term || matches(labels.myCustomers))
        ? [
            {
              id: "my-customers",
              label: labels.myCustomers,
              description: labels.myCustomersHint,
            },
          ]
        : []),
      ...CUSTOMER_PROFILE_SEARCH_FIELDS.map((entry) =>
        suggestion(entry.id, entry.kind !== "text"),
      ),
    ];
  }

  function change(basic: CustomerProfileBasicSearch) {
    onChange({ ...state, mode: "basic", basic });
  }

  function resetDraft() {
    setQuery("");
    setField(null);
  }

  function select(id: string) {
    if (!field && id === "my-customers") {
      change({ ...state.basic, myCustomers: true });
      resetDraft();
      return;
    }
    if (field) {
      const definition = customerProfileSearchField(field);
      change(
        addCustomerProfileBasicFilter(state.basic, {
          field,
          value: definition.kind === "text" ? term : id,
        }),
      );
      resetDraft();
      return;
    }
    const selected = CUSTOMER_PROFILE_SEARCH_FIELDS.find(
      (entry) => entry.id === id,
    );
    if (!selected) return;
    if (selected.kind === "text" && term) {
      change(
        addCustomerProfileBasicFilter(state.basic, {
          field: selected.id,
          value: term,
        }),
      );
      resetDraft();
      return;
    }
    setField(selected.id);
    if (
      selected.kind !== "text" &&
      !valuesFor(selected.id).some((entry) => matches(entry.label))
    ) {
      setQuery("");
    }
  }

  return {
    labels,
    query,
    tokens,
    options,
    prompt: field ? fieldLabels[field] : undefined,
    placeholder: field ? labels.chooseValue : t.crmCustomerProfiles.search,
    emptyLabel:
      field === "source" && sourcesDegraded
        ? labels.catalogueUnavailable
        : field && customerProfileSearchField(field).kind === "text"
          ? labels.typeValue
          : labels.noMatches,
    setQuery,
    select,
    resetDraft,
    remove(id: string) {
      change(removeCustomerProfileBasicFilter(state.basic, id));
    },
    clear() {
      change(EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH);
      resetDraft();
    },
  };
}
