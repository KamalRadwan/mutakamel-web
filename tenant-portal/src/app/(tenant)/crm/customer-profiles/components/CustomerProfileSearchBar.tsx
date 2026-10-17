"use client";

import {
  Building2,
  CheckCircle2,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { Button, PageActions, cn, iconSize } from "@/design-system";
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
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const activeAdvancedConditions = value.groups.reduce(
    (sum, group) =>
      sum +
      group.conditions.filter(
        (cond) =>
          cond.field &&
          (cond.value.trim().length > 0 || cond.valueTo.trim().length > 0),
      ).length,
    0,
  );

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
          className={cn(
            "gap-1.5 font-semibold transition-all",
            value.mode === "advanced" &&
              "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
          )}
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
          <span>{t.crmCustomerProfiles.searchMode.advanced}</span>
          {value.mode === "advanced" && activeAdvancedConditions > 0 && (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {activeAdvancedConditions}
            </span>
          )}
        </Button>
      </PageActions>

      {value.mode === "advanced" && (
        <div className="overflow-hidden rounded-xl border border-blue-500/25 bg-card shadow-sm">
          {/* Executive Advanced Search Header Bar with Quick Filter Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-gradient-to-r from-blue-500/[0.06] via-indigo-500/[0.04] to-transparent px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Filter className="size-3.5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground">
                  {isAr
                    ? "منشئ شجرة الفلاتر المتقدمة (AND / OR)"
                    : "Advanced Filter Tree Builder (AND / OR)"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "ادمج عدة شروط أو اختر فلترًا سريعًا ثم اضغط تطبيق"
                    : "Combine multi-group conditions or pick a quick preset, then click Apply"}
                </p>
              </div>
            </div>

            {/* Quick Advanced Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3 text-amber-500" />
                {isAr ? "قوالب سريعة:" : "Quick Presets:"}
              </span>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(
                    customerProfileSearchWithGroups(value, [
                      {
                        conditions: [
                          {
                            field: "profileType",
                            operator: "eq",
                            value: "CORPORATE",
                            valueTo: "",
                          },
                        ],
                      },
                    ]),
                  );
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Building2 className="size-3 text-blue-500" />
                {isAr ? "شركات فقط (B2B)" : "Corporate Only (B2B)"}
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(
                    customerProfileSearchWithGroups(value, [
                      {
                        conditions: [
                          {
                            field: "status",
                            operator: "eq",
                            value: "ACTIVE_CUSTOMER",
                            valueTo: "",
                          },
                        ],
                      },
                    ]),
                  );
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <CheckCircle2 className="size-3 text-emerald-500" />
                {isAr ? "عملاء نشطون" : "Active Customers"}
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(
                    customerProfileSearchWithGroups(value, [
                      {
                        conditions: [
                          {
                            field: "rating",
                            operator: "gte",
                            value: "2",
                            valueTo: "",
                          },
                        ],
                      },
                    ]),
                  );
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300"
              >
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {isAr ? "تقييم مرتفع (2★+)" : "High Priority (2★+)"}
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(customerProfileSearchCleared(value))}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                {isAr ? "تصفير الشجرة" : "Clear Tree"}
              </button>
            </div>
          </div>

          <div className="p-2">
            <CustomerProfileAdvancedSearch
              state={value}
              sources={sources}
              disabled={disabled}
              onChange={onChange}
              onSubmit={onSubmit}
            />
          </div>
        </div>
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
