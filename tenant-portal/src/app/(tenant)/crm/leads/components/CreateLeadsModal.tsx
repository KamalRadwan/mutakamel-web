"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  Button,
  DegradedBanner,
  FormModal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChip,
  WorkspaceLink,
  cn,
  type FormModalSection,
} from "@/design-system";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { resolveCompanyForBranch } from "@/lib/api/organization-scope";
import { getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { readOwnerOptions } from "../[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsUserName,
  type LeadDetailsUser,
} from "../[id]/lead-details-edit-contract";
import { useCreateLeadForm } from "../hooks/useCreateLeadForm";
import { useCreateLeadTags } from "../hooks/useCreateLeadTags";
import { useLeadCompanyOptions } from "../hooks/useLeadCompanyOptions";
import { useLeadDuplicateCheck } from "../hooks/useLeadDuplicateCheck";
import {
  LEAD_CREATE_LIMITS,
  isCorporateLead,
  usesExistingCompany,
  type CreateLeadForm,
  type QuickCreateLeadDraft,
} from "../lead-create-contract";
import {
  leadCreateSectionErrorCount,
  type LeadCreateMessages,
  type LeadCreateSectionId,
} from "../lead-create-validation";
import type { LeadStage } from "../lead-list-contract";
import { CreateTagModal } from "./create-lead/CreateTagModal";
import { LeadAddressSection } from "./create-lead/LeadAddressSection";
import { LeadClassificationSection } from "./create-lead/LeadClassificationSection";
import { LeadCompanySection } from "./create-lead/LeadCompanySection";
import { LeadContactsSection } from "./create-lead/LeadContactsSection";
import { LeadFieldGuide } from "./create-lead/LeadFieldGuide";
import { LeadPersonSection } from "./create-lead/LeadPersonSection";
import { LeadQualificationSection } from "./create-lead/LeadQualificationSection";

const DEFAULT_OWNER_VALUE = "__default_owner__";
const TERMINAL_STAGE_FLAG = "CONVERTED";

export interface CreateLeadsModalProps {
  isOpen?: boolean;
  stages: readonly LeadStage[];
  branchId: string | null;
  initialStageId?: string;
  initialDraft?: QuickCreateLeadDraft | null;
  onSubmit: (form: CreateLeadForm, initialRating?: number) => Promise<boolean>;
  error: string | null;
  onClose: () => void;
}

/**
 * Full-viewport Create New Lead Modal (Redesigned v2).
 *
 * Features:
 * - Multi-toned semantic section cards (Indigo, Emerald, Violet, Sky, Amber, Teal)
 * - Interactive `!` Field Guide hover/focus tooltips on every field and selector
 * - Smart Left Rail with Individual (B2C) vs. Corporate (B2B) mode switcher,
 *   live section status stepper, real-time Kanban Board Card Preview, and
 *   Duplicate Radar status monitor
 * - Assigned Salesperson (`ownerUserId`) & Initial Rating (1–3 Stars) in header
 * - Client-side existing company name detector + Server-side Duplicate Check
 * - Inline Tag Creation Modal (`CreateTagModal`)
 */
export function CreateLeadsModal({
  isOpen = true,
  stages,
  branchId,
  initialStageId,
  initialDraft,
  onSubmit,
  error,
  onClose,
}: CreateLeadsModalProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const scope = useTenantBranchSelection(user);
  const sharedFieldMessages = useCrmFieldMessages();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialRating, setInitialRating] = useState<number>(0);
  const [createTagDraftName, setCreateTagDraftName] = useState<string | null>(
    null,
  );
  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);
  const [selectedCompanyOverride, setSelectedCompanyOverride] = useState<
    string | null
  >(null);

  // Available non-converted stages
  const creatableStages = useMemo(
    () => stages.filter((stage) => stage.flag !== TERMINAL_STAGE_FLAG),
    [stages],
  );

  const sources = useCrmAcquisitionSources();
  const tags = useCreateLeadTags(isOpen);
  const customFields = useCrmCreateCustomFields("LEAD", isOpen);

  const defaultHonorific = useMemo(
    () => getHonorificOptions(lang)[0]?.label ?? "",
    [lang],
  );

  const validationMessages = useMemo<LeadCreateMessages>(
    () => ({
      ...sharedFieldMessages,
      contactRequired: t.crmLeads.create.errors.contactRequired,
      tagsLimit: formatTemplate(t.crmLeads.create.errors.tagsLimit, {
        max: LEAD_CREATE_LIMITS.tags,
      }),
      tagsInvalid: t.crmLeads.create.errors.tagsInvalid,
      allowedStageIds:
        creatableStages.length > 0
          ? new Set(creatableStages.map((stage) => stage.id))
          : undefined,
      allowedTagIds:
        tags.canRead && !tags.isLoading && !tags.degraded
          ? new Set(tags.items.map((tag) => tag.id))
          : undefined,
    }),
    [
      sharedFieldMessages,
      t,
      creatableStages,
      tags.canRead,
      tags.isLoading,
      tags.degraded,
      tags.items,
    ],
  );

  const state = useCreateLeadForm(
    validationMessages,
    customFields.requiredFieldKeys,
    initialStageId,
    defaultHonorific,
    initialDraft,
  );
  const { form, errors, allErrors } = state;

  const effectiveBranchId = form.branchId || branchId || scope.branchId || "";
  const companyIds = useMemo(
    () => user?.accessibleCompanies ?? [],
    [user?.accessibleCompanies],
  );
  const effectiveCompanyId = useMemo(
    () =>
      selectedCompanyOverride ??
      resolveCompanyForBranch(user, effectiveBranchId || null),
    [selectedCompanyOverride, user, effectiveBranchId],
  );

  const corporate = isCorporateLead(form);
  const existingCompany = usesExistingCompany(form);

  const companyOptions = useLeadCompanyOptions(
    effectiveBranchId || null,
    isOpen && corporate,
  );

  const duplicateMatches = useLeadDuplicateCheck(
    form,
    effectiveBranchId || null,
    isOpen,
  );

  // Load branch salesperson options for ownerUserId selector
  useEffect(() => {
    if (!isOpen || !isUUIDv7(effectiveBranchId)) return;
    const controller = new AbortController();
    void readOwnerOptions(effectiveBranchId, controller.signal)
      .then((users) => {
        if (!controller.signal.aborted) setOwnerOptions(users);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOwnerOptions([]);
      });
    return () => controller.abort();
  }, [isOpen, effectiveBranchId]);

  // Client-side check: did the user type a new company name that already exists in the directory?
  const matchingDirectoryCompany = useMemo(() => {
    if (!corporate || existingCompany) return null;
    const typed = form.companyName.trim().toLowerCase();
    if (typed.length < 2) return null;
    return (
      companyOptions.companies.find(
        (company) =>
          company.displayName.trim().toLowerCase() === typed ||
          (company.legalName?.trim().toLowerCase() ?? "") === typed,
      ) ?? null
    );
  }, [corporate, existingCompany, form.companyName, companyOptions.companies]);

  const visibleSections = useMemo<LeadCreateSectionId[]>(() => {
    const list: LeadCreateSectionId[] = ["classification"];
    if (corporate) {
      list.push("company", "contacts");
    } else {
      list.push("person");
    }
    if (!existingCompany) {
      list.push("address");
    }
    list.push("qualification");
    if (customFields.definitions.length > 0) {
      list.push("customFields");
    }
    return list;
  }, [corporate, existingCompany, customFields.definitions.length]);

  const sections = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((id) => ({
        id,
        label: t.crmLeads.create.sections[id],
        invalid: leadCreateSectionErrorCount(errors, id) > 0,
      })),
    [visibleSections, errors, t],
  );

  // Live preview computed values
  const previewName = useMemo(() => {
    if (corporate) {
      return form.companyName.trim() || t.crmLeads.companyName;
    }
    const parts = [
      form.honorificTitle.trim(),
      form.firstName.trim(),
      form.lastName.trim(),
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(" ")
      : `${t.crmLeads.create.firstName} ${t.crmLeads.create.lastName}`;
  }, [
    corporate,
    form.companyName,
    form.honorificTitle,
    form.firstName,
    form.lastName,
    t,
  ]);

  const previewStage = useMemo(() => {
    if (!form.stageId) return t.crmLeads.defaultStage;
    const found = creatableStages.find((stage) => stage.id === form.stageId);
    return found ? localizedName(found, lang) : t.crmLeads.defaultStage;
  }, [form.stageId, creatableStages, lang, t.crmLeads.defaultStage]);

  const previewSource = useMemo(() => {
    if (!form.acquisitionSourceId) return null;
    const found = sources.items.find(
      (item) => item.id === form.acquisitionSourceId,
    );
    return found ? localizedName(found, lang) : null;
  }, [form.acquisitionSourceId, sources.items, lang]);

  const previewPhone = useMemo(() => {
    if (corporate) {
      const primary =
        form.contacts.find((c) => c.isPrimary) ?? form.contacts[0];
      return (
        primary?.phones.find((p) => p.trim()) ??
        form.companyPhones.find((p) => p.trim()) ??
        ""
      );
    }
    return form.phones.find((p) => p.trim()) ?? "";
  }, [corporate, form.contacts, form.companyPhones, form.phones]);

  const previewTags = useMemo(
    () =>
      form.tagIds
        .map((id) => tags.items.find((tag) => tag.id === id))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
        .slice(0, 3),
    [form.tagIds, tags.items],
  );

  const errorCount = Object.keys(errors).length;
  const isReadyToSubmit = Object.keys(allErrors).length === 0;

  async function handleFormSubmit(keepOpenAfterSuccess = false) {
    state.revealAll();
    if (Object.keys(state.allErrors).length > 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payloadForm: CreateLeadForm = {
        ...form,
        branchId: effectiveBranchId,
      };
      const saved = await onSubmit(
        payloadForm,
        initialRating > 0 ? initialRating : undefined,
      );
      if (saved && keepOpenAfterSuccess) {
        state.reset();
        setInitialRating(0);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function scrollToSection(sectionId: string) {
    const node = document.querySelector<HTMLElement>(
      `[data-form-section="${sectionId}"]`,
    );
    if (!node) return;
    const closedTrigger = node.querySelector<HTMLButtonElement>(
      'button[data-state="closed"], [data-state="closed"] button',
    );
    if (closedTrigger) closedTrigger.click();
    node.scrollIntoView?.({ block: "start" });
  }

  return (
    <>
      <FormModal
        open={isOpen}
        size="full"
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={t.crmLeads.addTitle}
        description={
          corporate
            ? t.crmLeads.create.companyDetailsSubtitle
            : t.crmLeads.create.contactDetailsSubtitle
        }
        isDirty={state.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={() => void handleFormSubmit(false)}
        error={error ?? undefined}
        headerIcon={
          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 via-violet-600 to-sky-500 text-white shadow-sm">
            <UserPlus className="size-5" aria-hidden="true" />
          </div>
        }
        titleBadge={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                corporate
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300",
              )}
            >
              {corporate ? (
                <Building2 className="size-3.5" aria-hidden="true" />
              ) : (
                <User className="size-3.5" aria-hidden="true" />
              )}
              {corporate
                ? `${t.crmLeads.create.types.CORPORATE} · B2B`
                : `${t.crmLeads.create.types.INDIVIDUAL} · B2C`}
            </span>

            <span className="hidden items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 sm:inline-flex dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300">
              <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-extrabold text-white">
                !
              </span>
              {lang === "ar"
                ? "دليل الحقول التفاعلي مفعّل"
                : "Interactive Field Guide"}
            </span>
          </div>
        }
        headerAside={
          <div className="flex flex-wrap items-center gap-3">
            {/* Initial Star Rating Selector (1..3 stars) */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t.crmLeads.card.rating}:
              </span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3].map((star) => {
                  const active = star <= initialRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={isSubmitting}
                      aria-label={formatTemplate(t.crmLeads.card.rateStars, {
                        count: star,
                        max: 3,
                      })}
                      onClick={() =>
                        setInitialRating((curr) => (curr === star ? 0 : star))
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
              <div className="flex items-center gap-1.5">
                <div className="w-44">
                  <Select
                    value={form.ownerUserId || DEFAULT_OWNER_VALUE}
                    disabled={isSubmitting}
                    onValueChange={(val) =>
                      state.setField(
                        "ownerUserId",
                        val === DEFAULT_OWNER_VALUE ? "" : val,
                      )
                    }
                  >
                    <SelectTrigger size="sm" aria-label={t.crmLeads.salesperson}>
                      <SelectValue placeholder={t.crmLeads.salesperson} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_OWNER_VALUE}>
                        {user
                          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                            user.email
                          : t.crmLeads.salesperson}
                      </SelectItem>
                      {ownerOptions.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {leadDetailsUserName(owner)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <LeadFieldGuide field="ownerUserId" />
              </div>
            )}
          </div>
        }
        bodyClassName="bg-muted/30"
        asideSlot={
          <div className="flex h-full flex-col justify-between gap-4 p-4">
            <div className="space-y-4">
              {/* Interactive Form Sections Navigation */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  {t.crmShared.formSectionsNav}
                </span>
                <nav
                  aria-label={t.crmShared.formSectionsNav}
                  className="flex flex-col gap-1"
                >
                  {sections.map((section, idx) => {
                    const secErrors = leadCreateSectionErrorCount(
                      errors,
                      section.id as LeadCreateSectionId,
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
                            : "border-border/70 bg-card text-foreground hover:border-indigo-500/40 hover:bg-indigo-500/[0.04]",
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                              secErrors > 0
                                ? "bg-destructive text-white"
                                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
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
                        ) : section.id === "contacts" ? (
                          <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                            {form.contacts.length}/{LEAD_CREATE_LIMITS.contacts}
                          </span>
                        ) : section.id === "address" ||
                          section.id === "qualification" ? (
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

            {/* 3. Live Board Card Preview & Duplicate Radar Status */}
            <div className="space-y-3">
              {/* Live Board Card Preview */}
              <div className="rounded-xl border border-indigo-500/25 bg-card p-3 shadow-xs">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-300">
                    {lang === "ar"
                      ? "معاينة بطاقة اللوحة"
                      : "Live Card Preview"}
                  </span>
                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                    {previewStage}
                  </span>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-bold text-foreground">
                      {previewName}
                    </p>
                    {initialRating > 0 && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {Array.from({ length: initialRating }).map((_, i) => (
                          <Star
                            key={i}
                            className="size-3 fill-amber-400 text-amber-400"
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {previewPhone && (
                    <div
                      dir="ltr"
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <Phone className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{previewPhone}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {previewSource && (
                      <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {previewSource}
                      </span>
                    )}
                    {previewTags.map((tag) => (
                      <TagChip
                        key={tag.id}
                        label={tag.name}
                        backgroundColor={tag.backgroundColor}
                        textColor={tag.textColor}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Duplicate Radar Status */}
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-2.5 text-xs",
                  duplicateMatches.length > 0 || matchingDirectoryCompany
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
                )}
              >
                {duplicateMatches.length > 0 || matchingDirectoryCompany ? (
                  <ShieldAlert
                    className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck
                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {duplicateMatches.length > 0 || matchingDirectoryCompany
                      ? lang === "ar"
                        ? "تنبيه رادار التكرار"
                        : "Duplicate Radar Alert"
                      : lang === "ar"
                        ? "رادار التكرار: سليم"
                        : "Duplicate Radar: Clear"}
                  </div>
                  <div className="truncate text-[10px] opacity-80">
                    {duplicateMatches.length > 0
                      ? `${duplicateMatches.length} potential match(es)`
                      : matchingDirectoryCompany
                        ? matchingDirectoryCompany.displayName
                        : "Phone, Email, Tax & CR checked"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        footerLeading={
          <div className="flex flex-wrap items-center gap-2.5">
            {errorCount > 0 ? (
              <p
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
              >
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {formatTemplate(t.crmShared.formErrorCount, {
                  count: errorCount,
                })}
              </p>
            ) : isReadyToSubmit ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                {t.crmLeads.create.readyBadge}
              </span>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => void handleFormSubmit(true)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {lang === "ar" ? "إنشاء وإضافة آخر" : "Create & Add Another"}
            </Button>
          </div>
        }
        submitIcon={<CheckCircle2 className="size-4" aria-hidden="true" />}
        submitClassName={
          corporate
            ? "bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
            : "bg-linear-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white border-0"
        }
        labels={{
          submit: isSubmitting ? t.crmLeads.creating : t.common.create,
          cancel: t.common.cancel,
          discardTitle: t.common.discardTitle,
          discardDescription: t.common.discardDescription,
          discardConfirm: t.common.discardConfirm,
          discardCancel: t.common.cancel,
          sections: t.crmShared.formSectionsNav,
          sectionInvalid: t.crmShared.formSectionInvalid,
          close: t.common.close,
        }}
      >
        {/* Degraded Catalogue Banners */}
        {sources.degraded && (
          <DegradedBanner message={t.crmLeads.create.sourcesUnavailable} />
        )}
        {customFields.degraded && (
          <DegradedBanner message={t.crmShared.customFieldsUnavailable} />
        )}

        {/* Client-side Existing Directory Company Match Warning Banner */}
        {matchingDirectoryCompany && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle
                className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-bold">
                  {lang === "ar"
                    ? `توجد شركة بنفس الاسم في الدليل: "${matchingDirectoryCompany.displayName}"`
                    : `A company named "${matchingDirectoryCompany.displayName}" already exists in the directory.`}
                </p>
                <p className="text-[11px] opacity-85">
                  {lang === "ar"
                    ? "يمكنك ربط العميل المحتمل بالشركة المسجلة بدلاً من إنشاء سجل مكرر."
                    : "Link to the existing directory organization instead of creating a duplicate party."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                state.selectCompany(
                  matchingDirectoryCompany.id,
                  matchingDirectoryCompany.displayName,
                );
                void companyOptions.selectCompany(matchingDirectoryCompany.id);
              }}
              className="border-amber-500/50 bg-amber-500/20 text-amber-900 hover:bg-amber-500/30 dark:text-amber-100"
            >
              {t.crmLeads.existingCompany}
            </Button>
          </div>
        )}

        {/* Server-side Duplicate Check Advisory Banner (`POST /leads/duplicate-check`) */}
        {duplicateMatches.length > 0 && (
          <div
            role="status"
            className="space-y-2 rounded-xl border border-rose-500/35 bg-rose-500/[0.08] p-3.5 text-xs text-rose-900 dark:border-rose-400/35 dark:bg-rose-500/15 dark:text-rose-200"
          >
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert
                className="size-4 shrink-0 text-rose-600 dark:text-rose-400"
                aria-hidden="true"
              />
              <span>
                {lang === "ar"
                  ? `رادار التكرار: تم العثور على ${duplicateMatches.length} تطابق محتمل`
                  : `Duplicate Radar detected ${duplicateMatches.length} potential match(es)`}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {duplicateMatches.slice(0, 4).map((match) => {
                const firstLead = match.leads[0];
                return (
                  <li
                    key={match.partyId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-card/90 px-3 py-2 text-foreground"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {match.displayName ?? match.partyId}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                          {match.partyType}
                        </span>
                        {match.matchTypes.map((field) => (
                          <span
                            key={field}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                    {firstLead && (
                      <WorkspaceLink
                        href={`/crm/leads/${firstLead.id}`}
                        label={t.crmLeads.card.open}
                        icon={ExternalLink}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Section 01: Classification (Indigo Card) */}
        <LeadClassificationSection
          companyIds={companyIds}
          companyId={effectiveCompanyId}
          branchIds={scope.branchIds}
          branchId={effectiveBranchId}
          leadProfileType={form.leadProfileType}
          stageId={form.stageId}
          acquisitionSourceId={form.acquisitionSourceId}
          tagIds={form.tagIds}
          stages={creatableStages}
          sources={sources.items}
          tags={tags.items}
          showTags={tags.canRead}
          tagsLoading={tags.isLoading}
          tagsUnavailable={tags.degraded}
          errors={errors}
          disabled={isSubmitting}
          canCreateTag={tags.canManage}
          onCreateTag={(draftName) => setCreateTagDraftName(draftName)}
          onCompanyChange={(nextCompanyId) =>
            setSelectedCompanyOverride(nextCompanyId)
          }
          onBranchChange={(nextBranchId) => {
            state.setField("branchId", nextBranchId);
            state.selectCompany("", "");
            companyOptions.reset();
          }}
          onProfileTypeChange={state.setProfileType}
          onStageChange={(nextStageId) => state.setField("stageId", nextStageId)}
          onSourceChange={(nextSourceId) => {
            state.setField("acquisitionSourceId", nextSourceId);
            state.touch("acquisitionSourceId");
          }}
          onTagsChange={(nextTagIds) => state.setField("tagIds", nextTagIds)}
          onTagsBlur={() => state.touch("tagIds")}
        />

        {/* Section 02: Identity (Individual Person Card OR Corporate Company + Contacts Cards) */}
        {corporate ? (
          <>
            <LeadCompanySection
              form={form}
              errors={errors}
              options={companyOptions}
              disabled={isSubmitting}
              onSelectCompany={state.selectCompany}
              onFieldChange={(key, value) => state.setField(key, value)}
              onPhoneChange={(index, value) =>
                state.setPhone("companyPhones", index, value)
              }
              onPhoneAdd={() => state.addPhone("companyPhones")}
              onPhoneRemove={(index) =>
                state.removePhone("companyPhones", index)
              }
              onBlur={state.touch}
            />

            <LeadContactsSection
              form={form}
              directoryContacts={companyOptions.contacts}
              isLoadingContacts={companyOptions.isLoadingContacts}
              errors={errors}
              disabled={isSubmitting}
              onContactChange={state.updateContact}
              onPrimaryChange={state.setContactPrimary}
              onAdd={state.addContact}
              onRemove={state.removeContact}
              onPhoneChange={state.setContactPhone}
              onPhoneAdd={state.addContactPhone}
              onPhoneRemove={state.removeContactPhone}
              onBlur={state.touch}
            />
          </>
        ) : (
          <LeadPersonSection
            form={form}
            errors={errors}
            disabled={isSubmitting}
            onFieldChange={(key, value) => state.setField(key, value)}
            onPhoneChange={(index, value) =>
              state.setPhone("phones", index, value)
            }
            onPhoneAdd={() => state.addPhone("phones")}
            onPhoneRemove={(index) => state.removePhone("phones", index)}
            onBlur={state.touch}
          />
        )}

        {/* Section 03 & 04: Address (Amber) & Qualification (Violet) */}
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            !existingCompany && "xl:grid-cols-2",
          )}
        >
          {!existingCompany && (
            <LeadAddressSection
              address={form.address}
              errors={errors}
              disabled={isSubmitting}
              defaultOpen={false}
              onChange={state.setAddressField}
              onBlur={state.touch}
            />
          )}

          <LeadQualificationSection
            form={form}
            errors={errors}
            disabled={isSubmitting}
            defaultOpen={true}
            onChange={(key, value) => state.setField(key, value)}
            onBlur={state.touch}
          />
        </div>

        {/* Section 05: Tenant Custom Fields (Teal Card) */}
        {customFields.definitions.length > 0 && (
          <div className="relative overflow-hidden rounded-xl border border-teal-500/20 bg-card shadow-xs dark:border-teal-400/20">
            <div
              aria-hidden="true"
              className="h-1 w-full bg-linear-to-r from-teal-500 via-emerald-500 to-cyan-500"
            />
            <div className="p-4">
              <div className="mb-2 flex justify-end">
                <LeadFieldGuide field="customFields" />
              </div>
              <CrmCustomFieldsFormSection
                definitions={customFields.definitions}
                requiredFieldKeys={customFields.requiredFieldKeys}
                values={form.customFields}
                errors={errors}
                disabled={isSubmitting}
                onChange={state.setCustomField}
                onBlur={state.touch}
              />
            </div>
          </div>
        )}
      </FormModal>

      {/* Inline Create Tag Modal */}
      {tags.canManage && (
        <CreateTagModal
          open={createTagDraftName !== null}
          initialName={createTagDraftName ?? ""}
          existingTags={tags.items}
          onClose={() => setCreateTagDraftName(null)}
          onSuccess={(newTag) => {
            tags.addTag(newTag);
            if (
              !form.tagIds.includes(newTag.id) &&
              form.tagIds.length < LEAD_CREATE_LIMITS.tags
            ) {
              state.setField("tagIds", [...form.tagIds, newTag.id]);
            }
            setCreateTagDraftName(null);
          }}
        />
      )}
    </>
  );
}
