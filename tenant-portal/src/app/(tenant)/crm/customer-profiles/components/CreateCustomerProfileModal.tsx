"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  AmbiguousOutcomePanel,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DegradedBanner,
  Field,
  FormModal,
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
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { resolveCompanyForBranch } from "@/lib/api/organization-scope";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsUserName,
  type LeadDetailsUser,
} from "../../leads/[id]/lead-details-edit-contract";
import { CreateTagModal } from "../../leads/components/create-lead/CreateTagModal";
import { LeadAddressSection } from "../../leads/components/create-lead/LeadAddressSection";
import { LeadFieldGuide } from "../../leads/components/create-lead/LeadFieldGuide";
import { useCreateLeadTags } from "../../leads/hooks/useCreateLeadTags";
import { useLeadCompanyOptions } from "../../leads/hooks/useLeadCompanyOptions";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../shared/hooks/useAmbiguousOutcomeLabels";
import type { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  isCorporateCustomerProfile,
  usesExistingCustomerCompany,
} from "../customer-profile-create-contract";
import {
  customerProfileSectionErrorCount,
  type CustomerProfileSectionId,
} from "../customer-profile-create-validation";
import type { useCreateCustomerProfile } from "../hooks/useCreateCustomerProfile";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";
import { CustomerClassificationSection } from "./create-customer/CustomerClassificationSection";
import { CustomerCompanySection } from "./create-customer/CustomerCompanySection";
import { CustomerContactsSection } from "./create-customer/CustomerContactsSection";
import { CustomerPersonSection } from "./create-customer/CustomerPersonSection";

const DEFAULT_OWNER_VALUE = "__default_owner__";

export interface CreateCustomerProfileModalProps {
  create: ReturnType<typeof useCreateCustomerProfile>;
  sources: AcquisitionSource[];
  sourcesDegraded: boolean;
  customFields: ReturnType<typeof useCrmCreateCustomFields>;
}

/**
 * Full-viewport Create New Customer Profile Modal (Executive v2 — 100% parity with `CreateLeadsModal`).
 *
 * Features:
 * - Multi-toned semantic section cards (Indigo, Emerald, Violet, Sky, Amber, Teal)
 * - Interactive `!` Field Guide hover/focus tooltips on every field and selector
 * - Smart Left Rail with Individual (B2C) vs. Corporate (B2B) badge,
 *   live section status stepper, real-time Customer Card Preview with TagChips,
 *   and Duplicate Radar status monitor
 * - Assigned Salesperson (`ownerUserId`) & Initial Rating (1–3 Stars) in header
 * - `+ Create & Add Another` button in footer
 * - Directory company linking + contacts picker + Inline Tag Creation Modal (`CreateTagModal`)
 */
export function CreateCustomerProfileModal({
  create,
  sources,
  sourcesDegraded,
  customFields,
}: CreateCustomerProfileModalProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const scope = useTenantBranchSelection(user);
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const { form, errors, allErrors } = create;

  const corporate = isCorporateCustomerProfile(form);
  const existingCompany = usesExistingCustomerCompany(form);

  const [initialRating, setInitialRating] = useState(0);
  const [notesOpen, setNotesOpen] = useState(true);
  const [createTagDraftName, setCreateTagDraftName] = useState<string | null>(
    null,
  );
  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);
  const [selectedCompanyOverride, setSelectedCompanyOverride] = useState<
    string | null
  >(null);

  const effectiveBranchId = form.branchId || scope.branchId || "";
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

  const tags = useCreateLeadTags(create.open);
  const companyOptions = useLeadCompanyOptions(
    effectiveBranchId || null,
    create.open && corporate,
  );

  // Load branch salesperson options for ownerUserId selector
  useEffect(() => {
    if (!create.open || !isUUIDv7(effectiveBranchId)) return;
    const controller = new AbortController();
    void readOwnerOptions(effectiveBranchId, controller.signal)
      .then((users) => {
        if (!controller.signal.aborted) setOwnerOptions(users);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOwnerOptions([]);
      });
    return () => controller.abort();
  }, [create.open, effectiveBranchId]);

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

  const visibleSections = useMemo<CustomerProfileSectionId[]>(() => {
    const list: CustomerProfileSectionId[] = ["classification"];
    if (corporate) {
      list.push("company", "contacts");
    } else {
      list.push("person");
    }
    if (!existingCompany) {
      list.push("address");
    }
    list.push("notes");
    if (customFields.definitions.length > 0) {
      list.push("customFields");
    }
    return list;
  }, [corporate, existingCompany, customFields.definitions.length]);

  const indexEntries = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((section) => ({
        id: section,
        label:
          section === "address"
            ? t.crmLeads.create.sections.address
            : t.crmCustomerProfiles.create.sections[section],
        invalid: customerProfileSectionErrorCount(errors, section) > 0,
      })),
    [visibleSections, errors, t],
  );

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

  const previewStatusVisual = useMemo(
    () => getCustomerStatusVisual(form.status),
    [form.status],
  );

  const previewSource = useMemo(() => {
    if (!form.acquisitionSourceId) return null;
    const found = sources.find((item) => item.id === form.acquisitionSourceId);
    return found ? localizedName(found, lang) : null;
  }, [form.acquisitionSourceId, sources, lang]);

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
      (form.tagIds ?? [])
        .map((id) => tags.items.find((tag) => tag.id === id))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
        .slice(0, 3),
    [form.tagIds, tags.items],
  );

  const errorCount = Object.keys(errors).length;
  const isReadyToSubmit = Object.keys(allErrors).length === 0;
  const hasNotesError = Boolean(
    errors.description || errors.interestSummary || errors.expectedNeed,
  );
  const isNotesExpanded = notesOpen || hasNotesError;

  async function handleFormSubmit(keepOpenAfterSuccess = false) {
    const saved = await create.submit({
      keepOpenAfterSuccess,
      initialRating: initialRating > 0 ? initialRating : undefined,
    });
    if (saved && keepOpenAfterSuccess) {
      setInitialRating(0);
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
        open={create.open}
        size="full"
        onOpenChange={(open) => {
          if (!open) create.closeModal();
        }}
        title={t.crmCustomerProfileActions.createTitle}
        description={
          corporate
            ? t.crmLeads.create.companyDetailsSubtitle
            : t.crmLeads.create.contactDetailsSubtitle
        }
        isDirty={create.isDirty}
        isSubmitting={create.isSubmitting}
        onSubmit={() => void handleFormSubmit(false)}
        error={describeError(create.error) ?? undefined}
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
                      disabled={create.isSubmitting}
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
                    disabled={create.isSubmitting}
                    onValueChange={(val) =>
                      create.setField(
                        "ownerUserId",
                        val === DEFAULT_OWNER_VALUE ? "" : val,
                      )
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t.crmLeads.salesperson}
                    >
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
                  {indexEntries.map((section, idx) => {
                    const secErrors = customerProfileSectionErrorCount(
                      errors,
                      section.id as CustomerProfileSectionId,
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
                            {form.contacts.length}/
                            {CUSTOMER_PROFILE_CREATE_LIMITS.contacts}
                          </span>
                        ) : section.id === "address" ||
                          section.id === "notes" ? (
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

            {/* Live Customer Board Card Preview & Duplicate Radar Status */}
            <div className="space-y-3">
              {/* Live Customer Board Card Preview */}
              <div className="rounded-xl border border-indigo-500/25 bg-card p-3 shadow-xs">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-300">
                    {lang === "ar"
                      ? "معاينة بطاقة اللوحة"
                      : "Live Card Preview"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                      previewStatusVisual.badgeClass,
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        previewStatusVisual.dotClass,
                      )}
                    />
                    {t.statusValues[`CustomerStatus.${form.status}`] ??
                      form.status}
                  </span>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-bold text-foreground">
                      {previewName}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
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
                      <span className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                        {corporate ? "B2B" : "B2C"}
                      </span>
                    </div>
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

                  {(previewSource || previewTags.length > 0) && (
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
                  )}
                </div>
              </div>

              {/* Live Duplicate Radar Status */}
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-2.5 text-xs",
                  matchingDirectoryCompany
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
                )}
              >
                {matchingDirectoryCompany ? (
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
                    {matchingDirectoryCompany
                      ? lang === "ar"
                        ? "تنبيه رادار التكرار"
                        : "Duplicate Radar Alert"
                      : lang === "ar"
                        ? "رادار التكرار: سليم"
                        : "Duplicate Radar: Clear"}
                  </div>
                  <div className="truncate text-[10px] opacity-80">
                    {matchingDirectoryCompany
                      ? matchingDirectoryCompany.displayName
                      : lang === "ar"
                        ? "تم التحقق من الهواتف والبريد والسجل الضريبي"
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
              disabled={create.isSubmitting}
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
          submit: create.isSubmitting ? t.crmLeads.creating : t.common.create,
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
        {create.ambiguity && (
          <AmbiguousOutcomePanel
            operation={t.crmCustomerProfileActions.createOperation}
            idempotencyKey={create.ambiguity.attempt.idempotencyKey}
            description={t.crmCustomerProfileActions.ambiguousDescription}
            correlationId={create.ambiguity.error.correlationId}
            onRetry={() => void create.ambiguity?.replay()}
            onDismiss={create.dismissAmbiguity}
            labels={ambiguousLabels}
          />
        )}

        {create.appliedUnreadable && (
          <AmbiguousOutcomePanel
            operation={t.crmCustomerProfileActions.createOperation}
            idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey}
            description={t.crmShared.appliedUnreadableDescription}
            correlationId={create.appliedUnreadable.error.correlationId}
            onRetry={() => create.reconcile()}
            onDismiss={create.dismissAppliedUnreadable}
            labels={appliedLabels}
          />
        )}

        {sourcesDegraded && (
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
                    ? "يمكنك ربط العميل بالشركة المسجلة بدلاً من إنشاء سجل مكرر."
                    : "Link to the existing directory organization instead of creating a duplicate party."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                create.selectCompany(
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

        {/* Section 01: Classification (Indigo Card) */}
        <CustomerClassificationSection
          form={form}
          sources={sources}
          disabled={create.isSubmitting}
          companyIds={companyIds}
          companyId={effectiveCompanyId}
          branchIds={scope.branchIds}
          branchId={effectiveBranchId}
          tags={tags.items}
          showTags={tags.canRead}
          tagsLoading={tags.isLoading}
          tagsUnavailable={tags.degraded}
          errors={errors}
          canCreateTag={tags.canManage}
          onCreateTag={(draftName) => setCreateTagDraftName(draftName)}
          onCompanyChange={(nextCompanyId) =>
            setSelectedCompanyOverride(nextCompanyId)
          }
          onBranchChange={(nextBranchId) => {
            create.setField("branchId", nextBranchId);
            create.selectCompany("", "");
            companyOptions.reset();
          }}
          onProfileTypeChange={create.setProfileType}
          onFieldChange={create.setField}
          onTagsBlur={() => create.touch("tagIds")}
        />

        {/* Section 02: Identity (Individual Person Card OR Corporate Company + Contacts Cards) */}
        {corporate ? (
          <>
            <CustomerCompanySection
              form={form}
              errors={errors}
              options={companyOptions}
              disabled={create.isSubmitting}
              onSelectCompany={create.selectCompany}
              onFieldChange={create.setField}
              onPhoneChange={(index, value) =>
                create.setPhone("companyPhones", index, value)
              }
              onPhoneAdd={() => create.addPhone("companyPhones")}
              onPhoneRemove={(index) =>
                create.removePhone("companyPhones", index)
              }
              onBlur={create.touch}
            />
            <CustomerContactsSection
              form={form}
              directoryContacts={companyOptions.contacts}
              isLoadingContacts={companyOptions.isLoadingContacts}
              errors={errors}
              disabled={create.isSubmitting}
              onContactChange={create.updateContact}
              onPrimaryChange={create.setContactPrimary}
              onAdd={create.addContact}
              onRemove={create.removeContact}
              onPhoneChange={create.setContactPhone}
              onPhoneAdd={create.addContactPhone}
              onPhoneRemove={create.removeContactPhone}
              onBlur={create.touch}
            />
          </>
        ) : (
          <CustomerPersonSection
            form={form}
            errors={errors}
            disabled={create.isSubmitting}
            onFieldChange={create.setField}
            onPhoneChange={(index, value) =>
              create.setPhone("phones", index, value)
            }
            onPhoneAdd={() => create.addPhone("phones")}
            onPhoneRemove={(index) => create.removePhone("phones", index)}
            onBlur={create.touch}
          />
        )}

        {/* Section 03 & 04: Address (Amber) & Qualification / Internal Notes (Violet) */}
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
              disabled={create.isSubmitting}
              defaultOpen={false}
              onChange={create.setAddressField}
              onBlur={create.touch}
            />
          )}

          {/* Collapsible Violet Notes & Qualification Section */}
          <section
            id="notes"
            data-form-section="notes"
            className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-card shadow-xs transition-colors dark:border-violet-400/20"
          >
            <div
              aria-hidden="true"
              className="h-1 w-full bg-linear-to-r from-violet-500 via-indigo-500 to-purple-500"
            />

            <Collapsible open={isNotesExpanded} onOpenChange={setNotesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border/60 bg-violet-500/[0.03] px-4 py-3 text-start transition-colors hover:bg-violet-500/[0.06] dark:bg-violet-500/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300">
                      <Sparkles className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {t.crmCustomerProfiles.create.sections.notes}
                        </span>
                        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                          {t.crmLeads.create.optionalBadge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.crmLeads.create.qualificationCollapsibleSubtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isNotesExpanded && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  {/* Interest Summary */}
                  <div className="relative">
                    <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {(form.interestSummary ?? "").length}/
                        {CUSTOMER_PROFILE_CREATE_LIMITS.interestSummary}
                      </span>
                      <LeadFieldGuide field="interestSummary" />
                    </div>
                    <Field
                      label={t.crmLeads.create.interestSummary}
                      error={errors.interestSummary}
                      showLabel
                    >
                      <Textarea
                        rows={3}
                        placeholder={t.crmLeads.create.interestSummary}
                        value={form.interestSummary ?? ""}
                        maxLength={
                          CUSTOMER_PROFILE_CREATE_LIMITS.interestSummary
                        }
                        disabled={create.isSubmitting}
                        onChange={(event) =>
                          create.setField("interestSummary", event.target.value)
                        }
                        onBlur={() => create.touch("interestSummary")}
                      />
                    </Field>
                  </div>

                  {/* Expected Need */}
                  <div className="relative">
                    <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {(form.expectedNeed ?? "").length}/
                        {CUSTOMER_PROFILE_CREATE_LIMITS.expectedNeed}
                      </span>
                      <LeadFieldGuide field="expectedNeed" />
                    </div>
                    <Field
                      label={t.crmLeads.create.expectedNeed}
                      error={errors.expectedNeed}
                      showLabel
                    >
                      <Textarea
                        rows={3}
                        placeholder={t.crmLeads.create.expectedNeed}
                        value={form.expectedNeed ?? ""}
                        maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.expectedNeed}
                        disabled={create.isSubmitting}
                        onChange={(event) =>
                          create.setField("expectedNeed", event.target.value)
                        }
                        onBlur={() => create.touch("expectedNeed")}
                      />
                    </Field>
                  </div>

                  {/* Internal Notes (full width) */}
                  <div className="relative md:col-span-2">
                    <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {form.description.length}/
                        {CUSTOMER_PROFILE_CREATE_LIMITS.description}
                      </span>
                      <LeadFieldGuide field="description" />
                    </div>
                    <Field
                      label={t.crmLeads.create.description}
                      error={errors.description}
                      showLabel
                    >
                      <Textarea
                        rows={3}
                        placeholder={t.crmLeads.create.description}
                        value={form.description}
                        maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.description}
                        disabled={create.isSubmitting}
                        onChange={(event) =>
                          create.setField("description", event.target.value)
                        }
                        onBlur={() => create.touch("description")}
                      />
                    </Field>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>
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
                disabled={create.isSubmitting}
                onChange={create.setCustomField}
                onBlur={create.touch}
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
            const currentTagIds = form.tagIds ?? [];
            if (
              !currentTagIds.includes(newTag.id) &&
              currentTagIds.length < CUSTOMER_PROFILE_CREATE_LIMITS.tags
            ) {
              create.setField("tagIds", [...currentTagIds, newTag.id]);
            }
            setCreateTagDraftName(null);
          }}
        />
      )}
    </>
  );
}
