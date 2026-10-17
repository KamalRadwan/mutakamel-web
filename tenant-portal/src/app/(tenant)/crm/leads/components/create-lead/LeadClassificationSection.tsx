"use client";

import { useMemo, useState } from "react";
import { Building2, Compass, Layers, Search, Tag, User } from "lucide-react";
import {
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
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { CrmTag } from "../../../shared/tag-contract";
import { type CrmProfileType } from "../../lead-contract";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import type { LeadStage } from "../../lead-list-contract";
import { LeadFieldGuide } from "./LeadFieldGuide";

const DEFAULT_STAGE_VALUE = "__default_stage__";

const STAGE_DOT_BY_FLAG: Record<string, string> = {
  NEW: "bg-indigo-500 ring-indigo-500/25",
  IN_PROGRESS: "bg-sky-500 ring-sky-500/25",
  QUALIFIED: "bg-emerald-500 ring-emerald-500/25",
  UNQUALIFIED: "bg-amber-500 ring-amber-500/25",
  LOST: "bg-rose-500 ring-rose-500/25",
  CONVERTED: "bg-teal-500 ring-teal-500/25",
};

export interface LeadClassificationSectionProps {
  companyIds: readonly string[];
  companyId: string | null;
  branchIds: readonly string[];
  branchId: string;
  leadProfileType: CrmProfileType;
  stageId: string;
  acquisitionSourceId: string;
  tagIds: string[];
  stages: readonly LeadStage[];
  sources: readonly AcquisitionSource[];
  tags: readonly CrmTag[];
  showTags: boolean;
  tagsLoading: boolean;
  tagsUnavailable: boolean;
  errors: CrmFormErrors;
  disabled: boolean;
  canCreateTag?: boolean;
  onCreateTag?: (name: string) => void;
  onCompanyChange: (companyId: string) => void;
  onBranchChange: (branchId: string) => void;
  onProfileTypeChange: (profileType: CrmProfileType) => void;
  onStageChange: (stageId: string) => void;
  onSourceChange: (sourceId: string) => void;
  onTagsChange: (tagIds: string[]) => void;
  onTagsBlur: () => void;
}

/**
 * Section 01 — Lead Classification & Pipeline Routing (Indigo Theme).
 *
 * Houses organization/branch scope (when multi-company/multi-branch),
 * Individual vs. Company profile mode, pipeline stage with colored flag dots,
 * acquisition source with channel icons & inline search, and color-coded
 * multi-select tags with inline tag creation.
 */
export function LeadClassificationSection({
  companyIds,
  companyId,
  branchIds,
  branchId,
  leadProfileType,
  stageId,
  acquisitionSourceId,
  tagIds,
  stages,
  sources,
  tags,
  showTags,
  tagsLoading,
  tagsUnavailable,
  errors,
  disabled,
  canCreateTag = false,
  onCreateTag,
  onCompanyChange,
  onBranchChange,
  onProfileTypeChange,
  onStageChange,
  onSourceChange,
  onTagsChange,
  onTagsBlur,
}: LeadClassificationSectionProps) {
  const { t, lang } = useI18n();
  const [stageSearch, setStageSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");

  const showCompanyPicker = companyIds.length > 1;
  const showBranchPicker = branchIds.length > 1;
  const atTagLimit = tagIds.length >= LEAD_CREATE_LIMITS.tags;

  const filteredStages = useMemo(() => {
    const q = stageSearch.trim().toLowerCase();
    if (!q) return stages;
    return stages.filter(
      (stage) =>
        localizedName(stage, lang).toLowerCase().includes(q) ||
        stage.nameEn.toLowerCase().includes(q) ||
        stage.nameAr.toLowerCase().includes(q),
    );
  }, [stages, stageSearch, lang]);

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
        disabled: (tagsUnavailable && !isSelected) || (atTagLimit && !isSelected),
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
      data-form-section="classification"
      className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-card shadow-xs transition-colors dark:border-indigo-400/20"
    >
      {/* Top 3px colorful accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-linear-to-r from-indigo-600 via-violet-500 to-sky-500"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-indigo-500/[0.03] px-4 py-3 dark:bg-indigo-500/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300">
            <Compass className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                01
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-bold text-foreground outline-none"
              >
                {t.crmLeads.create.leadClassificationTitle}
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
            aria-label={t.crmLeads.create.leadType}
            className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onProfileTypeChange("INDIVIDUAL")}
              aria-pressed={leadProfileType === "INDIVIDUAL"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                leadProfileType === "INDIVIDUAL"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="size-3.5" aria-hidden="true" />
              {t.crmLeads.create.types.INDIVIDUAL}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onProfileTypeChange("CORPORATE")}
              aria-pressed={leadProfileType === "CORPORATE"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                leadProfileType === "CORPORATE"
                  ? "bg-violet-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Building2 className="size-3.5" aria-hidden="true" />
              {t.crmLeads.create.types.CORPORATE}
            </button>
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
                <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
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
                    onValueChange={onCompanyChange}
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
                <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
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
                    onValueChange={onBranchChange}
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

        {/* Primary 12-column classification grid: Stage (4 cols), Source (4 cols), Tags (4 cols) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Pipeline Stage */}
          <div className={cn("relative", showTags ? "md:col-span-4" : "md:col-span-6")}>
            <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                Pipeline
              </span>
              <LeadFieldGuide field="stageId" />
            </div>
            <Field
              label={t.crmLeads.stage}
              error={errors.stageId}
              showLabel
            >
              <Select
                value={stageId || DEFAULT_STAGE_VALUE}
                disabled={disabled}
                onValueChange={(value) =>
                  onStageChange(value === DEFAULT_STAGE_VALUE ? "" : value)
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t.crmLeads.defaultStage} />
                </SelectTrigger>
                <SelectContent>
                  {stages.length > 4 && (
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
                          value={stageSearch}
                          onChange={(e) => setStageSearch(e.target.value)}
                          placeholder={t.crmLeads.search}
                          className="ps-7"
                        />
                      </div>
                    </div>
                  )}
                  <SelectItem value={DEFAULT_STAGE_VALUE}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-indigo-500 ring-2 ring-indigo-500/25"
                      />
                      <span>{t.crmLeads.defaultStage}</span>
                    </span>
                  </SelectItem>
                  {filteredStages.map((stage) => {
                    const dotClass =
                      STAGE_DOT_BY_FLAG[stage.flag ?? "NEW"] ??
                      "bg-indigo-500 ring-indigo-500/25";
                    return (
                      <SelectItem key={stage.id} value={stage.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn("size-2 shrink-0 rounded-full ring-2", dotClass)}
                          />
                          <span>{localizedName(stage, lang)}</span>
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
            <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                {t.crmLeads.create.requiredFields.split(" ")[0]}
              </span>
              <LeadFieldGuide field="acquisitionSourceId" />
            </div>
            <Field
              label={t.crmLeads.source}
              error={errors.acquisitionSourceId}
              required
              showLabel
            >
              <Select
                value={acquisitionSourceId}
                disabled={disabled}
                onValueChange={onSourceChange}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} />
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
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                  <Tag className="size-2.5" aria-hidden="true" />
                  {tagIds.length}/{LEAD_CREATE_LIMITS.tags}
                </span>
                <LeadFieldGuide field="tagIds" />
              </div>
              <Field
                label={t.crmLeads.create.tags}
                error={errors.tagIds}
                hint={formatTemplate(t.crmLeads.create.tagsLimitHint, {
                  max: LEAD_CREATE_LIMITS.tags,
                  count: tagIds.length,
                })}
                showLabel
              >
                <MultiSelect
                  size="sm"
                  values={tagIds}
                  onValuesChange={onTagsChange}
                  options={tagOptions}
                  placeholder={t.crmLeads.create.tagsPlaceholder}
                  searchPlaceholder={t.crmLeads.create.tagsSearch}
                  emptyLabel={t.crmLeads.create.tagsEmpty}
                  moreLabel={t.crmLeads.card.moreTags}
                  removeLabel={t.crmPipelines.removeChip}
                  overflowLabel={t.crmLeads.create.tagsOverflow}
                  disabled={disabled || tagsLoading}
                  onBlur={onTagsBlur}
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
