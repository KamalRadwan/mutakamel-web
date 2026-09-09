"use client";

import {
  Field,
  FormSection,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import type { LeadTag } from "../../lead-card-contract";
import {
  CRM_PROFILE_TYPES,
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
  tags: LeadTag[];
  showTags: boolean;
  tagsLoading: boolean;
  tagsUnavailable: boolean;
  errors: LeadCreateErrors;
  disabled: boolean;
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
    <FormSection
      id="classification"
      title={t.crmLeads.create.sections.classification}
      columns={3}
    >
      {companyIds.length > 1 && (
        // Ids, not names: `/auth/me` is the only proven source for which
        // companies this account may use and it carries no names — the same
        // call `TenantBranchSelect` and `TradeScopeBar` already make. `dir` on
        // the trigger is what keeps the UUID readable in an RTL paragraph.
        <Field label={t.organization.parentCompany}>
          <Select
            value={companyId ?? undefined}
            disabled={disabled}
            onValueChange={onCompanyChange}
          >
            <SelectTrigger dir="ltr" className="font-mono">
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
        <Field label={t.common.branch} required>
          <Select
            value={branchId || undefined}
            disabled={disabled}
            onValueChange={onBranchChange}
          >
            <SelectTrigger dir="ltr" className="font-mono">
              {/* No prompt: the inset label already says Branch. A
                  placeholder survives only where it says what leaving the
                  field empty MEANS — the stage default below. */}
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

      <Field label={t.crmLeads.create.leadType} required>
        <Select
          value={leadProfileType}
          disabled={disabled}
          onValueChange={(value) => onProfileTypeChange(value as CrmProfileType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_PROFILE_TYPES.map((profileType) => (
              <SelectItem key={profileType} value={profileType}>
                {t.crmLeads.create.types[profileType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmLeads.stage}>
        <Select
          value={stageId || DEFAULT_STAGE_VALUE}
          disabled={disabled}
          onValueChange={(value) => onStageChange(value === DEFAULT_STAGE_VALUE ? "" : value)}
        >
          <SelectTrigger>
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

      {/* The "no source" option is gone, not disabled: this form requires a
          source, and an option whose only effect is to fail validation is a
          trap. Its absence is also why nothing here can return to the empty
          value once a source has been picked. */}
      <Field label={t.crmLeads.source} error={errors.acquisitionSourceId} required>
        <Select
          value={acquisitionSourceId || undefined}
          disabled={disabled}
          onValueChange={onSourceChange}
        >
          <SelectTrigger>
            {/* Not "No source": that is the name of a STATE this form no
                longer has, and reading it in an empty required box invites
                the user to leave it alone. */}
            <SelectValue />
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
          hint={formatTemplate(t.crmLeads.create.tagsLimitHint, {
            count: tagIds.length,
            max: LEAD_CREATE_LIMITS.tags,
          })}
        >
          <MultiSelect
            values={tagIds}
            onValuesChange={(next) => {
              if (next.length <= LEAD_CREATE_LIMITS.tags) onTagsChange(next);
            }}
            options={tags.map((tag) => ({
              value: tag.id,
              label: tag.name,
              // At the ceiling, existing selections stay removable while only
              // choices that would make CreateLeadDto invalid are disabled.
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
            // A degraded catalogue blocks new choices, not chip removal.
            disabled={disabled || tagsLoading}
            onBlur={onTagsBlur}
          />
        </Field>
      )}
    </FormSection>
  );
}
