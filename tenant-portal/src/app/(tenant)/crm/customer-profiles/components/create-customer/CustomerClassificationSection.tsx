"use client";

import { useMemo, useState } from "react";
import { Building2, Compass, Search, Tag, User } from "lucide-react";
import {
  Button,
  DegradedBanner,
  Field,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  type MultiSelectOption,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { LeadFieldGuide } from "../../../leads/components/create-lead/LeadFieldGuide";
import { type CrmProfileType } from "../../../leads/lead-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { CrmTag } from "../../../shared/tag-contract";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  CUSTOMER_PROFILE_STATUSES,
  type CreateCustomerProfileForm,
  type CustomerProfileCreateStatus,
} from "../../customer-profile-create-contract";

/** Sentinel for "no acquisition source", since a `Select` item needs a value. */
const NO_SOURCE_VALUE = "__none__";

const STATUS_DOT_BY_VALUE: Record<CustomerProfileCreateStatus, string> = {
  PROSPECT: "bg-swatch-indigo",
  ACTIVE_CUSTOMER: "bg-swatch-green",
  INACTIVE: "bg-swatch-amber",
  BLACKLISTED: "bg-swatch-red",
};

export interface CustomerClassificationSectionProps {
  form: CreateCustomerProfileForm;
  sources: readonly AcquisitionSource[];
  disabled: boolean;
  companyIds?: readonly string[];
  companyId?: string | null;
  branchIds?: readonly string[];
  branchId?: string;
  tags?: readonly CrmTag[];
  showTags?: boolean;
  tagsLoading?: boolean;
  tagsUnavailable?: boolean;
  errors?: CrmFormErrors;
  canCreateTag?: boolean;
  onCreateTag?: (name: string) => void;
  onCompanyChange?: (companyId: string) => void;
  onBranchChange?: (branchId: string) => void;
  onProfileTypeChange: (profileType: CrmProfileType) => void;
  onFieldChange: <K extends "status" | "acquisitionSourceId" | "tagIds">(
    key: K,
    value: CreateCustomerProfileForm[K],
  ) => void;
  onTagsBlur?: () => void;
}

/**
 * Section 01 — Customer Classification & Status Routing (Indigo Theme).
 *
 * Matches `LeadClassificationSection` 100%:
 * - Organization/branch scope selectors (when multi-company/multi-branch)
 * - Individual vs. Company profile mode toggle pill in header
 * - Customer status with colored flag dots
 * - Acquisition source with channel icons & inline search
 * - Color-coded multi-select tags with inline tag creation
 */
export function CustomerClassificationSection({
  form,
  sources,
  disabled,
  companyIds = [],
  companyId = null,
  branchIds = [],
  branchId = "",
  tags = [],
  showTags = true,
  tagsLoading = false,
  tagsUnavailable = false,
  errors = {},
  canCreateTag = false,
  onCreateTag,
  onCompanyChange,
  onBranchChange,
  onProfileTypeChange,
  onFieldChange,
  onTagsBlur,
}: CustomerClassificationSectionProps) {
  const { t, lang } = useI18n();
  const [sourceSearch, setSourceSearch] = useState("");

  const showCompanyPicker = companyIds.length > 1;
  const showBranchPicker = branchIds.length > 1;
  const tagIds = useMemo(() => form.tagIds ?? [], [form.tagIds]);
  const atTagLimit = tagIds.length >= CUSTOMER_PROFILE_CREATE_LIMITS.tags;

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (source) =>
        localizedName(source, lang).toLowerCase().includes(q) ||
        source.nameEn.toLowerCase().includes(q) ||
        source.nameAr.toLowerCase().includes(q),
    );
  }, [sources, sourceSearch, lang]);

  const tagOptions = useMemo<MultiSelectOption[]>(() => {
    const selectedSet = new Set(tagIds);
    return tags.map((tag) => {
      const isSelected = selectedSet.has(tag.id);
      const hasColor = Boolean(tag.backgroundColor && tag.textColor);
      return {
        value: tag.id,
        label: tag.name,
        disabled:
          (tagsUnavailable && !isSelected) || (atTagLimit && !isSelected),
        tagColor: hasColor
          ? {
              backgroundColor: tag.backgroundColor!,
              textColor: tag.textColor!,
            }
          : null,
      };
    });
  }, [tags, tagIds, tagsUnavailable, atTagLimit]);

  return (
    <section
      id="classification"
      data-form-section="classification"
      className="relative overflow-hidden rounded-lg border border-swatch-indigo-soft bg-card shadow-xs transition-colors"
    >
      {/* Top 3px colorful accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-swatch-indigo"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-swatch-indigo-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-swatch-indigo-soft bg-swatch-indigo-soft text-swatch-indigo-deep">
            <Compass className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span dir="ltr" className="rounded bg-swatch-indigo-soft px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-swatch-indigo-deep">
                01
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-semibold text-foreground outline-none"
              >
                {t.crmCustomerProfiles.create.sections.classification}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.crmLeads.create.steps.essential.description}
            </p>
          </div>
        </div>

        {/* Profile Type Quick Toggle Pills + Guide */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={t.crmCustomerProfiles.type}
            className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5"
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={() => onProfileTypeChange("INDIVIDUAL")}
              aria-pressed={form.profileType === "INDIVIDUAL"}
              className={cn(
                "h-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                form.profileType === "INDIVIDUAL"
                  ? "bg-swatch-green text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="size-3.5" aria-hidden="true" />
              {t.crmCustomerProfiles.profileTypes.INDIVIDUAL}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={() => onProfileTypeChange("CORPORATE")}
              aria-pressed={form.profileType === "CORPORATE"}
              className={cn(
                "h-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                form.profileType === "CORPORATE"
                  ? "bg-swatch-purple text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Building2 className="size-3.5" aria-hidden="true" />
              {t.crmCustomerProfiles.profileTypes.CORPORATE}
            </Button>
          </div>
          <LeadFieldGuide field="leadProfileType" />
        </div>
      </div>

      {/* Section Body */}
      <div className="space-y-4 p-4">
        {/* Multi-company / multi-branch scope selectors (rendered only when > 1 option) */}
        {(showCompanyPicker || showBranchPicker) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {showCompanyPicker && (
              <div className="relative">
                <div className="absolute end-0 top-0 flex items-center gap-1.5">
                  <LeadFieldGuide field="companyId" />
                </div>
                <Field
                  label={t.organization.parentCompany}
                  required
                  showLabel
                >
                  <Select
                    value={companyId ?? ""}
                    disabled={disabled}
                    onValueChange={(val) => onCompanyChange?.(val)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder={t.organization.parentCompany} />
                    </SelectTrigger>
                    <SelectContent>
                      {companyIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            {showBranchPicker && (
              <div className="relative">
                <div className="absolute end-0 top-0 flex items-center gap-1.5">
                  <LeadFieldGuide field="branchId" />
                </div>
                <Field
                  label={t.common.branch}
                  error={errors.branchId}
                  required
                  showLabel
                >
                  <Select
                    value={branchId}
                    disabled={disabled}
                    onValueChange={(val) => onBranchChange?.(val)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder={t.common.branch} />
                    </SelectTrigger>
                    <SelectContent>
                      {branchIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Primary 12-column classification grid: Status (4 cols), Source (4 cols), Tags (4 cols) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Customer Status */}
          <div className={cn("relative", showTags ? "md:col-span-4" : "md:col-span-6")}>
            <div className="absolute end-0 top-0 flex items-center gap-1.5">
              <span className="rounded bg-swatch-indigo-soft px-1.5 py-0.5 text-2xs font-semibold text-swatch-indigo-deep">
                Pipeline
              </span>
              <LeadFieldGuide field="stageId" />
            </div>
            <Field
              label={t.common.status}
              hint={t.crmCustomerProfiles.create.statusHint}
              showLabel
            >
              <Select
                value={form.status}
                disabled={disabled}
                onValueChange={(value) =>
                  onFieldChange("status", value as CustomerProfileCreateStatus)
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_PROFILE_STATUSES.map((status) => {
                    const dotClass =
                      STATUS_DOT_BY_VALUE[status] ??
                      "bg-swatch-indigo";
                    return (
                      <SelectItem key={status} value={status}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn("size-2 shrink-0 rounded-full", dotClass)}
                          />
                          <span>
                            {t.statusValues[`CustomerStatus.${status}`] ?? status}
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Acquisition Source */}
          <div className={cn("relative", showTags ? "md:col-span-4" : "md:col-span-6")}>
            <div className="absolute end-0 top-0 flex items-center gap-1.5">
              <LeadFieldGuide field="acquisitionSourceId" />
            </div>
            <Field
              label={t.crmLeads.source}
              error={errors.acquisitionSourceId}
              showLabel
            >
              <Select
                value={form.acquisitionSourceId || NO_SOURCE_VALUE}
                disabled={disabled}
                onValueChange={(value) =>
                  onFieldChange(
                    "acquisitionSourceId",
                    value === NO_SOURCE_VALUE ? "" : value,
                  )
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t.crmLeadDetail.noSource} />
                </SelectTrigger>
                <SelectContent>
                  {sources.length > 4 && (
                    <div
                      className="border-b border-border p-1.5"
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="relative flex items-center">
                        <Search
                          className="pointer-events-none absolute start-2 size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          size="xs"
                          value={sourceSearch}
                          onChange={(e) => setSourceSearch(e.target.value)}
                          placeholder={t.crmLeads.create.selectSourcePlaceholder}
                          className="ps-7"
                        />
                      </div>
                    </div>
                  )}
                  <SelectItem value={NO_SOURCE_VALUE}>
                    <AcquisitionSourceOption
                      source={null}
                      label={t.crmLeadDetail.noSource}
                    />
                  </SelectItem>
                  {filteredSources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      <AcquisitionSourceOption
                        source={source}
                        label={localizedName(source, lang)}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Classification Tags (MultiSelect with Search & Inline Create) */}
          {showTags && (
            <div className="relative md:col-span-4">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span dir="ltr" className="inline-flex items-center gap-1 rounded bg-swatch-purple-soft px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-swatch-purple-deep">
                  <Tag className="size-2.5" aria-hidden="true" />
                  {tagIds.length}/{CUSTOMER_PROFILE_CREATE_LIMITS.tags}
                </span>
                <LeadFieldGuide field="tagIds" />
              </div>
              <Field
                label={t.crmLeads.create.tags}
                error={errors.tagIds}
                hint={formatTemplate(t.crmLeads.create.tagsLimitHint, {
                  max: CUSTOMER_PROFILE_CREATE_LIMITS.tags,
                  count: tagIds.length,
                })}
                showLabel
              >
                <MultiSelect
                  size="sm"
                  values={tagIds}
                  onValuesChange={(nextTagIds) =>
                    onFieldChange("tagIds", nextTagIds)
                  }
                  options={tagOptions}
                  placeholder={t.crmLeads.create.tagsPlaceholder}
                  searchPlaceholder={t.crmLeads.create.tagsSearch}
                  emptyLabel={t.crmLeads.create.tagsEmpty}
                  moreLabel={t.crmLeads.card.moreTags}
                  removeLabel={t.crmPipelines.removeChip}
                  overflowLabel={t.crmLeads.create.tagsOverflow}
                  disabled={disabled || tagsLoading}
                  onBlur={() => onTagsBlur?.()}
                  onCreate={
                    canCreateTag && !tagsUnavailable && !atTagLimit
                      ? onCreateTag
                      : undefined
                  }
                  createLabel={t.crmLeads.create.createTagAction}
                />
              </Field>
            </div>
          )}
        </div>

        {showTags && tagsUnavailable && (
          <DegradedBanner message={t.crmLeads.create.tagsUnavailable} />
        )}
      </div>
    </section>
  );
}
