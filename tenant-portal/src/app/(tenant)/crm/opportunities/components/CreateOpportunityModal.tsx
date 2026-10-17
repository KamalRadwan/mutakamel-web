"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  Check,
  CirclePercent,
  Plus,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  AmbiguousOutcomePanel,
  Button,
  Combobox,
  DatePicker,
  DegradedBanner,
  Field,
  FormModal,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChip,
  Textarea,
  cn,
  type FormModalSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsUserName,
  type LeadDetailsUser,
} from "../../leads/[id]/lead-details-edit-contract";
import { CreateTagModal } from "../../leads/components/create-lead/CreateTagModal";
import { useCreateLeadTags } from "../../leads/hooks/useCreateLeadTags";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../shared/hooks/useAmbiguousOutcomeLabels";
import type { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { fromIsoDate, toIsoDate } from "../../shared/iso-date";
import type { OpportunityPipeline } from "../hooks/pipeline-types";
import type { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { useCustomerProfileOptions } from "../hooks/useCustomerProfileOptions";
import {
  OPPORTUNITY_SECTION_IDS,
  type OpportunitySectionId,
} from "../opportunity-create-validation";

const DEFAULT_OWNER_VALUE = "__default_owner__";
const CURRENCY_PRESETS = ["EGP", "USD", "SAR", "AED", "EUR"] as const;
const PROBABILITY_PRESETS = ["25", "50", "75", "90"] as const;

export interface CreateOpportunityModalProps {
  create: ReturnType<typeof useCreateOpportunity>;
  pipelines: OpportunityPipeline[];
  branchId: string | null;
  customFields: ReturnType<typeof useCrmCreateCustomFields>;
}

/**
 * Full-viewport Create Opportunity Modal (Executive v2 — 100% parity with
 * `CreateLeadsModal` & `CreateCustomerProfileModal`).
 */
export function CreateOpportunityModal({
  create,
  pipelines,
  branchId,
  customFields,
}: CreateOpportunityModalProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const { user } = useTenantAuth();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const customers = useCustomerProfileOptions(branchId, create.open);
  const tags = useCreateLeadTags(create.open);
  const { form, errors } = create;

  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);
  const [createTagDraftName, setCreateTagDraftName] = useState<string | null>(
    null,
  );

  // Load branch salesperson options for header ownerUserId selector
  useEffect(() => {
    if (!create.open || !branchId || !isUUIDv7(branchId)) return;
    const controller = new AbortController();
    void readOwnerOptions(branchId, controller.signal)
      .then((users) => {
        if (!controller.signal.aborted) setOwnerOptions(users);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOwnerOptions([]);
      });
    return () => controller.abort();
  }, [create.open, branchId]);

  const visibleSections = useMemo<OpportunitySectionId[]>(
    () =>
      OPPORTUNITY_SECTION_IDS.filter(
        (section) =>
          section !== "customFields" || customFields.definitions.length > 0,
      ),
    [customFields.definitions.length],
  );

  const indexEntries = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((section) => ({
        id: section,
        label: t.crmOpportunityDetail.create.sections[section],
        invalid: create.sectionErrorCount(section) > 0,
      })),
    [visibleSections, create, t],
  );

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === form.pipelineId) ?? null,
    [pipelines, form.pipelineId],
  );
  const selectedStage = useMemo(
    () =>
      create.selectableStages.find((s) => s.id === form.stageId) ??
      create.selectableStages[0] ??
      null,
    [create.selectableStages, form.stageId],
  );

  const currentImportance = Number(form.importance || "0") || 0;
  const selectedTagObjects = useMemo(
    () =>
      (form.tagIds ?? [])
        .map((id) => tags.items.find((tag) => tag.id === id))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
    [form.tagIds, tags.items],
  );

  const errorCount = Object.keys(errors).length;

  function scrollToSection(sectionId: string) {
    const node = document.querySelector<HTMLElement>(
      `[data-form-section="${sectionId}"]`,
    );
    node?.scrollIntoView?.({ block: "start" });
  }

  return (
    <>
      <FormModal
        open={create.open}
        size="full"
        onOpenChange={(open) => {
          if (!open) create.closeModal();
        }}
        title={t.crmOpportunityDetail.createTitle}
        description={t.crmOpportunityDetail.createDescription}
        isDirty={create.isDirty}
        isSubmitting={create.isSubmitting}
        onSubmit={() => void create.submit({ keepOpenAfterSuccess: false })}
        error={describeError(create.error) ?? undefined}
        headerIcon={
          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 via-indigo-600 to-emerald-500 text-white shadow-sm">
            <TrendingUp className="size-5" aria-hidden="true" />
          </div>
        }
        titleBadge={
          <div className="flex flex-wrap items-center gap-2">
            {selectedPipeline && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {localizedName(selectedPipeline, lang)}
                {selectedStage ? ` · ${localizedName(selectedStage, lang)}` : ""}
              </span>
            )}
          </div>
        }
        headerAside={
          <div className="flex flex-wrap items-center gap-3">
            {/* Initial Importance Star Selector (1..3 stars) */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t.crmOpportunities.importance}:
              </span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3].map((star) => {
                  const active = star <= currentImportance;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={create.isSubmitting}
                      aria-label={formatTemplate(
                        t.crmOpportunities.setImportance,
                        { level: star },
                      )}
                      onClick={() =>
                        create.setField(
                          "importance",
                          currentImportance === star ? "0" : String(star),
                        )
                      }
                      className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "size-4 transition-colors",
                          active
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40 hover:text-amber-400/70",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assigned Salesperson (`ownerUserId`) */}
            {ownerOptions.length > 0 && (
              <div className="w-44">
                <Select
                  value={form.ownerUserId || DEFAULT_OWNER_VALUE}
                  disabled={create.isSubmitting}
                  onValueChange={(val) =>
                    create.setField(
                      "ownerUserId",
                      val === DEFAULT_OWNER_VALUE ? "" : val,
                    )
                  }
                >
                  <SelectTrigger size="sm" aria-label={t.crmOpportunities.owner}>
                    <SelectValue placeholder={t.crmOpportunities.owner} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_OWNER_VALUE}>
                      {user
                        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                          user.email
                        : t.crmOpportunities.owner}
                    </SelectItem>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {leadDetailsUserName(owner)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        }
        bodyClassName="bg-muted/30"
        asideSlot={
          <div className="flex h-full flex-col justify-between gap-4 p-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  {t.crmShared.formSectionsNav}
                </span>
                <nav
                  aria-label={t.crmShared.formSectionsNav}
                  className="flex flex-col gap-1"
                >
                  {indexEntries.map((section, idx) => {
                    const secErrors = create.sectionErrorCount(
                      section.id as OpportunitySectionId,
                    );
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-medium transition-colors",
                          secErrors > 0
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-border/70 bg-card text-foreground hover:border-blue-500/40 hover:bg-blue-500/[0.04]",
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                              secErrors > 0
                                ? "bg-destructive text-white"
                                : "bg-blue-500/15 text-blue-600 dark:text-blue-300",
                            )}
                          >
                            0{idx + 1}
                          </span>
                          <span className="truncate">{section.label}</span>
                        </span>

                        {secErrors > 0 ? (
                          <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                            {secErrors}
                          </span>
                        ) : section.id === "notes" ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {t.crmLeads.create.optionalBadge}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {t.crmLeads.create.readyBadge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Live Opportunity Board Card Preview */}
            <div className="rounded-xl border border-blue-500/25 bg-card p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-300">
                  {isAr ? "معاينة بطاقة الفرصة" : "Live Deal Card Preview"}
                </span>
                {selectedStage && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {localizedName(selectedStage, lang)}
                  </span>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Building2 className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {create.customerLabel ||
                      t.crmOpportunityDetail.selectCustomer}
                  </span>
                </div>

                <p className="truncate text-xs font-extrabold text-foreground">
                  {form.title.trim() || t.crmOpportunities.title}
                </p>

                <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-300">
                    <Banknote className="size-3" aria-hidden="true" />
                    {form.amount.trim() ? (
                      <Money
                        value={form.amount.trim()}
                        currency={form.currencyCode.trim().toUpperCase() || "EGP"}
                        language={lang}
                      />
                    ) : (
                      "0.00"
                    )}
                  </span>
                  {form.probabilityPercent.trim() && (
                    <span className="inline-flex items-center gap-0.5 font-bold text-blue-600 dark:text-blue-400">
                      <CirclePercent className="size-3" aria-hidden="true" />
                      {form.probabilityPercent.trim()}%
                    </span>
                  )}
                </div>

                {selectedTagObjects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTagObjects.slice(0, 3).map((tag) => (
                      <TagChip
                        key={tag.id}
                        label={tag.name}
                        backgroundColor={tag.backgroundColor}
                        textColor={tag.textColor}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((st) => (
                      <Star
                        key={st}
                        className={cn(
                          "size-3",
                          st <= currentImportance
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30",
                        )}
                      />
                    ))}
                  </div>
                  {form.expectedCloseDate && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="size-2.5" aria-hidden="true" />
                      {form.expectedCloseDate}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        }
        labels={{
          submit: t.common.create,
          cancel: t.common.cancel,
          discardTitle: t.common.discardTitle,
          discardDescription: t.common.discardDescription,
          discardConfirm: t.common.discardConfirm,
          discardCancel: t.common.cancel,
          sections: t.crmShared.formSectionsNav,
          sectionInvalid: t.crmShared.formSectionInvalid,
          close: t.common.close,
        }}
        footerLeading={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={create.isSubmitting}
              onClick={() => void create.submit({ keepOpenAfterSuccess: true })}
            >
              <Plus className="me-1 size-3.5" aria-hidden="true" />
              {isAr ? "إنشاء وإضافة أخرى" : "Create & Add Another"}
            </Button>
            {errorCount > 0 && (
              <p role="status" className="text-xs text-destructive">
                {formatTemplate(t.crmShared.formErrorCount, {
                  count: errorCount,
                })}
              </p>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          {create.ambiguity && (
            <AmbiguousOutcomePanel
              operation={t.crmOpportunityDetail.createOperation}
              idempotencyKey={create.ambiguity.attempt.idempotencyKey}
              description={t.crmOpportunityDetail.ambiguousDescription}
              correlationId={create.ambiguity.error.correlationId}
              onRetry={() => void create.ambiguity?.replay()}
              onDismiss={create.dismissAmbiguity}
              labels={ambiguousLabels}
            />
          )}

          {create.appliedUnreadable && (
            <AmbiguousOutcomePanel
              operation={t.crmOpportunityDetail.createOperation}
              idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey}
              description={t.crmShared.appliedUnreadableDescription}
              correlationId={create.appliedUnreadable.error.correlationId}
              onRetry={() => create.reconcile()}
              onDismiss={create.dismissAppliedUnreadable}
              labels={appliedLabels}
            />
          )}

          {customFields.degraded && (
            <DegradedBanner message={t.crmShared.customFieldsUnavailable} />
          )}

          {/* SECTION 01: Customer & Pipeline Placement */}
          <section
            id="placement"
            data-form-section="placement"
            className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-card shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-indigo-500/15 bg-linear-to-r from-indigo-500/[0.08] via-blue-500/[0.04] to-transparent px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white">
                  01
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t.crmOpportunityDetail.create.sections.placement}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t.crmOpportunityDetail.create.placementDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <Field
                label={t.crmOpportunities.customer}
                error={errors.customerProfileId}
                required
              >
                <Combobox
                  value={form.customerProfileId || undefined}
                  selectedLabel={create.customerLabel}
                  onValueChange={(next) => {
                    const option = customers.items.find(
                      ({ id }) => id === next,
                    );
                    create.selectCustomer(
                      next ?? "",
                      option?.displayName ?? "",
                    );
                    create.touch("customerProfileId");
                  }}
                  options={customers.items.map((profile) => ({
                    value: profile.id,
                    label: profile.displayName,
                    description: profile.companyName ?? undefined,
                  }))}
                  onSearch={customers.search}
                  loading={customers.isLoading}
                  disabled={create.isSubmitting}
                  placeholder={t.crmOpportunityDetail.selectCustomer}
                  searchPlaceholder={t.crmCustomerProfiles.search}
                  loadingLabel={t.common.loading}
                  emptyLabel={t.crmOpportunityDetail.noCustomers}
                />
              </Field>

              <Field
                label={t.crmOpportunities.pipeline}
                error={errors.pipelineId}
                required
              >
                <Select
                  value={form.pipelineId}
                  disabled={create.isSubmitting}
                  onValueChange={(value) => {
                    create.selectPipeline(value);
                    create.touch("pipelineId");
                  }}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {localizedName(pipeline, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="md:col-span-2">
                <Field
                  label={t.crmOpportunities.stage}
                  hint={t.crmOpportunityDetail.stageHint}
                  error={errors.stageId}
                  required
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {create.selectableStages.map((stage) => {
                        const isSelected = form.stageId === stage.id;
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            disabled={create.isSubmitting}
                            onClick={() => {
                              create.setField("stageId", stage.id);
                              create.touch("stageId");
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all",
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                                : "border-border bg-background text-foreground hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800",
                            )}
                          >
                            {isSelected && (
                              <Check className="size-3.5" aria-hidden="true" />
                            )}
                            <span>{localizedName(stage, lang)}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Keep accessible Select for keyboard & automated form readers */}
                    <div className="sr-only">
                      <Select
                        value={form.stageId}
                        disabled={
                          create.isSubmitting ||
                          create.selectableStages.length === 0
                        }
                        onValueChange={(value) => {
                          create.setField("stageId", value);
                          create.touch("stageId");
                        }}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {create.selectableStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {localizedName(stage, lang)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* SECTION 02: Deal Commercials & Forecast */}
          <section
            id="deal"
            data-form-section="deal"
            className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-card shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-emerald-500/15 bg-linear-to-r from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-emerald-600 font-mono text-xs font-bold text-white">
                  02
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t.crmOpportunityDetail.create.sections.deal}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t.crmOpportunityDetail.create.dealDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
              <Field
                label={t.crmOpportunities.title}
                error={errors.title}
                required
                className="md:col-span-2"
              >
                <Input
                  size="sm"
                  placeholder={t.crmOpportunities.title}
                  value={form.title}
                  maxLength={180}
                  disabled={create.isSubmitting}
                  onChange={(event) =>
                    create.setField("title", event.target.value)
                  }
                  onBlur={() => create.touch("title")}
                />
              </Field>

              <Field label={t.crmOpportunities.expectedClose}>
                <DatePicker
                  value={fromIsoDate(form.expectedCloseDate)}
                  onValueChange={(next) =>
                    create.setField("expectedCloseDate", toIsoDate(next))
                  }
                  placeholder={t.crmLeadConvert.selectDate}
                  clearLabel={t.crmLeadConvert.clearDate}
                />
              </Field>

              <Field
                label={t.crmOpportunityDetail.amount}
                hint={t.crmLeadConvert.amountHint}
                error={errors.amount}
              >
                <Input
                  size="sm"
                  placeholder={t.crmOpportunityDetail.amount}
                  value={form.amount}
                  inputMode="decimal"
                  dir="ltr"
                  disabled={create.isSubmitting}
                  onChange={(event) =>
                    create.setField("amount", event.target.value)
                  }
                  onBlur={() => create.touch("amount")}
                />
              </Field>

              <Field
                label={t.crmLeadConvert.currencyCode}
                hint={t.crmLeadConvert.currencyHint}
                error={errors.currencyCode}
              >
                <div className="space-y-1.5">
                  <Input
                    size="sm"
                    placeholder={t.crmLeadConvert.currencyCode}
                    value={form.currencyCode}
                    maxLength={3}
                    dir="ltr"
                    disabled={create.isSubmitting}
                    onChange={(event) =>
                      create.setField("currencyCode", event.target.value)
                    }
                    onBlur={() => create.touch("currencyCode")}
                  />
                  <div className="flex flex-wrap gap-1">
                    {CURRENCY_PRESETS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={create.isSubmitting}
                        onClick={() => create.setField("currencyCode", code)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors",
                          form.currencyCode.toUpperCase() === code
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>

              <Field
                label={t.crmOpportunityDetail.create.probabilityPercent}
                hint={t.crmOpportunityDetail.create.probabilityHint}
                error={errors.probabilityPercent}
              >
                <div className="space-y-1.5">
                  <Input
                    size="sm"
                    placeholder={
                      t.crmOpportunityDetail.create.probabilityPercent
                    }
                    value={form.probabilityPercent}
                    inputMode="numeric"
                    dir="ltr"
                    className="tabular-nums"
                    disabled={create.isSubmitting}
                    onChange={(event) =>
                      create.setField("probabilityPercent", event.target.value)
                    }
                    onBlur={() => create.touch("probabilityPercent")}
                  />
                  <div className="flex flex-wrap gap-1">
                    {PROBABILITY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={create.isSubmitting}
                        onClick={() =>
                          create.setField("probabilityPercent", preset)
                        }
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors",
                          form.probabilityPercent === preset
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </Field>

              <Field
                label={t.crmOpportunities.importance}
                hint={t.crmOpportunityDetail.create.importanceHint}
                error={errors.importance}
              >
                <Input
                  size="sm"
                  placeholder={t.crmOpportunities.importance}
                  value={form.importance}
                  inputMode="numeric"
                  dir="ltr"
                  className="tabular-nums"
                  disabled={create.isSubmitting}
                  onChange={(event) =>
                    create.setField("importance", event.target.value)
                  }
                  onBlur={() => create.touch("importance")}
                />
              </Field>
            </div>
          </section>

          {/* SECTION 03: Tags & Notes */}
          <section
            id="notes"
            data-form-section="notes"
            className="overflow-hidden rounded-2xl border border-amber-500/25 bg-card shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-amber-500/15 bg-linear-to-r from-amber-500/[0.08] via-orange-500/[0.04] to-transparent px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-amber-600 font-mono text-xs font-bold text-white">
                  03
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t.crmOpportunityDetail.create.sections.notes}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t.crmOpportunityDetail.create.notesDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Tags Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Tag className="size-3.5 text-amber-600" aria-hidden="true" />
                    {t.crmLeads.create.tags}
                  </span>
                  {tags.canManage && (
                    <button
                      type="button"
                      onClick={() => setCreateTagDraftName("")}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      <span>{t.crmTags.add}</span>
                    </button>
                  )}
                </div>

                {tags.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.items.map((tag) => {
                      const selected = (form.tagIds ?? []).includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => create.toggleTag(tag.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border p-0.5 transition-all",
                            selected
                              ? "border-blue-600 ring-2 ring-blue-500/20"
                              : "border-transparent opacity-75 hover:opacity-100",
                          )}
                        >
                          <TagChip
                            label={tag.name}
                            backgroundColor={tag.backgroundColor}
                            textColor={tag.textColor}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Field
                label={t.crmLeads.create.description}
                error={errors.description}
              >
                <Textarea
                  placeholder={t.crmLeads.create.description}
                  rows={4}
                  value={form.description}
                  maxLength={2000}
                  disabled={create.isSubmitting}
                  onChange={(event) =>
                    create.setField("description", event.target.value)
                  }
                  onBlur={() => create.touch("description")}
                />
              </Field>
            </div>
          </section>

          {/* SECTION 04: Custom Fields */}
          {customFields.definitions.length > 0 && (
            <div data-form-section="customFields">
              <CrmCustomFieldsFormSection
                definitions={customFields.definitions}
                requiredFieldKeys={customFields.requiredFieldKeys}
                values={form.customFields}
                errors={errors}
                disabled={create.isSubmitting}
                onChange={create.setCustomField}
                onBlur={create.touch}
              />
            </div>
          )}
        </div>
      </FormModal>

      <CreateTagModal
        open={createTagDraftName !== null}
        initialName={createTagDraftName ?? ""}
        existingTags={tags.items}
        onClose={() => setCreateTagDraftName(null)}
        onSuccess={(created) => {
          tags.addTag(created);
          create.toggleTag(created.id);
          setCreateTagDraftName(null);
        }}
      />
    </>
  );
}
