"use client";

import {
  Badge,
  Button,
  cn,
  Field,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { Building2, Target, User } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import { crmTagColor, type CrmTag } from "../../../shared/tag-contract";
import {
  LEAD_CREATE_LIMITS,
  type CrmProfileType,
} from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import type { LeadStage } from "../../hooks/useLeads";

/** Sentinel for "let the tenant default decide", which is `stageId` omitted. */
const DEFAULT_STAGE_VALUE = "__default__";

export interface LeadClassificationSectionProps {
  /**
   * Companies owning the branches this account may file into, from `/auth/me`.
   * Fewer than two and the picker is not rendered at all.
   */
  companyIds: readonly string[];
  companyId: string | null;
  /** Branches under the selected company — the list the picker below offers. */
  branchIds: readonly string[];
  branchId: string;
  leadProfileType: CrmProfileType;
  stageId: string;
  acquisitionSourceId: string;
  tagIds: string[];
  stages: LeadStage[];
  sources: AcquisitionSource[];
  tags: CrmTag[];
  showTags: boolean;
  tagsLoading: boolean;
  tagsUnavailable: boolean;
  errors: LeadCreateErrors;
  disabled: boolean;
  canCreateTag?: boolean;
  onCreateTag?: (query: string) => void;
  onCompanyChange: (companyId: string) => void;
  onBranchChange: (branchId: string) => void;
  onProfileTypeChange: (profileType: CrmProfileType) => void;
  onStageChange: (stageId: string) => void;
  onSourceChange: (acquisitionSourceId: string) => void;
  onTagsChange: (tagIds: string[]) => void;
  onTagsBlur: () => void;
}

/**
 * Where this lead is filed, and what kind of lead it is.
 *
 * Company and branch come first because they are the widest decision on the
 * form — everything below is read and written inside the branch chosen here.
 *
 * Each of the two is rendered ONLY when the account has more than one to pick
 * from. One choice is not a choice: a select holding a single option asks a
 * question with one answer, and on an account with one branch it would appear
 * on every create in the tenant's life. It renders nothing at all rather than
 * a disabled control, because there is no second state to unlock.
 *
 * The company NARROWS the branch list and is never sent. `CreateLeadDto` has
 * no company key of any kind (crm-app/src/crm/leads/dto/lead.dto.ts:197-320) —
 * `branchId` is the only organizational field on it and the service derives
 * the company from that branch. `existingCompanyPartyId` on the section below
 * is a different thing entirely: a CUSTOMER organization in the Directory, not
 * the tenant's own company. Sending this one would be a 400 from the whitelist.
 *
 * Lead type decides which of the sections below exist: an individual lead has
 * no company, no corporate registration and no contact people —
 * `LeadsService.create` writes none of them for `INDIVIDUAL`, and two of the
 * three are an outright 422.
 *
 * A `CONVERTED`-flagged stage is excluded: creating straight into one is
 * `422 LEAD_CONVERSION_REQUIRED`, because that transition is the conversion
 * operation's to make.
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
  canCreateTag,
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

  return (
    <section
      data-form-section="classification"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      {/* 1. Profile Type Switcher & Required fields indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label={t.crmLeads.create.leadType}
          className="flex items-center gap-1.5"
        >
          <Button
            type="button"
            role="radio"
            aria-checked={leadProfileType === "INDIVIDUAL"}
            disabled={disabled}
            onClick={() => onProfileTypeChange("INDIVIDUAL")}
            size="sm"
            variant={leadProfileType === "INDIVIDUAL" ? "outline" : "ghost"}
            className={cn(
              "gap-2 px-3 font-medium",
              leadProfileType === "INDIVIDUAL"
                ? "border-primary bg-card text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <User className="size-4 shrink-0" aria-hidden="true" />
            <span>{t.crmLeads.create.types.INDIVIDUAL}</span>
          </Button>

          <Button
            type="button"
            role="radio"
            aria-checked={leadProfileType === "CORPORATE"}
            disabled={disabled}
            onClick={() => onProfileTypeChange("CORPORATE")}
            size="sm"
            variant={leadProfileType === "CORPORATE" ? "outline" : "ghost"}
            className={cn(
              "gap-2 px-3 font-medium",
              leadProfileType === "CORPORATE"
                ? "border-primary bg-card text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            <span>{t.crmLeads.create.types.CORPORATE}</span>
          </Button>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="me-1 font-semibold text-destructive">*</span>
          {t.crmLeads.create.requiredFields}
        </span>
      </div>

      {/* 2. Lead classification Card */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-foreground">
            <Target className="size-4 text-muted-foreground" aria-hidden="true" />
            <h4 tabIndex={-1} className="text-sm font-semibold text-foreground outline-none">
              {t.crmLeads.create.leadClassificationTitle}
            </h4>
          </div>
          <Badge tone="positive">
            {t.crmLeads.create.readyBadge}
          </Badge>
        </div>

        {(companyIds.length > 1 || branchIds.length > 1) && (
          <div className="grid grid-cols-1 gap-2 border-b border-border pb-3 md:grid-cols-2">
            {companyIds.length > 1 && (
              <Field label={t.organization.parentCompany} showLabel>
                <Select
                  value={companyId ?? ""}
                  disabled={disabled}
                  onValueChange={onCompanyChange}
                >
                  <SelectTrigger size="sm" dir="ltr" className="font-mono">
                    <SelectValue />
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
            )}

            {branchIds.length > 1 && (
              <Field label={t.common.branch} required showLabel>
                <Select
                  value={branchId}
                  disabled={disabled}
                  onValueChange={onBranchChange}
                >
                  <SelectTrigger size="sm" dir="ltr" className="font-mono">
                    <SelectValue />
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
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 pt-3 md:grid-cols-3">
          <Field label={t.crmLeads.stage} required showLabel>
            <Select
              value={stageId || DEFAULT_STAGE_VALUE}
              disabled={disabled}
              onValueChange={(value) => onStageChange(value === DEFAULT_STAGE_VALUE ? "" : value)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={t.crmLeads.defaultStage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_STAGE_VALUE}>{t.crmLeads.defaultStage}</SelectItem>
                {stages
                  .filter((stage) => stage.flag !== "CONVERTED")
                  .map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {localizedName(stage, lang)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.crmLeads.source} error={errors.acquisitionSourceId} required showLabel>
            <Select
              value={acquisitionSourceId}
              disabled={disabled}
              onValueChange={onSourceChange}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {showTags && (
            <Field
              label={t.crmLeads.create.tags}
              error={errors.tagIds}
              showLabel
            >
              <MultiSelect
                size="sm"
                values={tagIds}
                onValuesChange={(next) => {
                  if (next.length <= LEAD_CREATE_LIMITS.tags) onTagsChange(next);
                }}
                options={tags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                  tagColor: crmTagColor(tag),
                  disabled:
                    !tagIds.includes(tag.id) &&
                    (tagsUnavailable || tagIds.length >= LEAD_CREATE_LIMITS.tags),
                }))}
                placeholder={
                  tagsLoading ? t.common.loading : t.crmLeads.create.tagsPlaceholder
                }
                searchPlaceholder={t.crmLeads.create.tagsSearch}
                emptyLabel={
                  tagsUnavailable
                    ? t.crmLeads.create.tagsUnavailable
                    : t.crmLeads.create.tagsEmpty
                }
                clearAllLabel={t.filters.clearAll}
                moreLabel={t.filters.more}
                removeLabel={t.filters.remove}
                overflowLabel={t.crmLeads.create.tagsOverflow}
                onCreate={canCreateTag ? onCreateTag : undefined}
                createLabel={t.crmLeads.create.createTagAction}
                disabled={disabled || tagsLoading}
                onBlur={onTagsBlur}
              />
            </Field>
          )}
        </div>
      </div>
    </section>
  );
}
