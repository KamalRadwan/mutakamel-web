"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ExternalLink,
  FileText,
  History,
  ListTodo,
  Lock,
  Paperclip,
  Sparkles,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ConfirmActionModal,
  DOSSIER_HEADER_CARD_COLORS,
  DegradedBanner,
  DetailHeader,
  ErrorState,
  NotFoundState,
  Skeleton,
  StageBar,
  StatusBadge,
  cardColorBorder,
  cn,
  dossierAvatarClass,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { formatDate } from "@/lib/format/date";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import { crmCapabilityAllowsOwner } from "../../../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { LEAD_STAGE_BAR_TONE } from "../../components/lead-view-config";
import { useLeadCapabilities } from "../../hooks/useLeadCapabilities";
import { leadPath, type LeadDetail } from "../../lead-contract";
import { formatLeadStageAge } from "../../lead-stage-age";
import type { LeadDetailCard } from "../lead-detail-card-contract";
import { useLeadCardEdit } from "../hooks/useLeadCardEdit";
import { useLeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import { useLeadConvert } from "../hooks/useLeadConvert";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { useLeadStageMove } from "../hooks/useLeadStageMove";
import { LeadCompanyCard } from "./LeadCompanyCard";
import { LeadContactsCard } from "./LeadContactsCard";
import { LeadConvertModal } from "./LeadConvertModal";
import { LeadIdentityCards } from "./LeadIdentityCards";
import { LeadRelatedNav } from "./LeadRelatedNav";

type DossierWorkspaceTab = "activities" | "notes" | "history" | "attachments";

/**
  * `/crm/leads/[id]` — Standalone 100% Full-Width Colorful Dossier 360° Workspace.
  */
export function LeadDetailWorkspace({ leadId }: { leadId: string }) {
  // Conversion attempts and card drafts belong to one record, including on client navigation.
  return <LeadDetailContent key={leadId} leadId={leadId} />;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function LeadDetailContent({ leadId }: { leadId: string }) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const describeError = useCrmErrorText();
  const detail = useLeadDetail(leadId);
  const lead = detail.lead;
  const { capabilities, error: capabilitiesError } = useLeadCapabilities(
    lead?.branchId ?? null,
  );
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();
  const [now] = useState(() => Date.now());

  // Card-specific editors own their changed-field saves; there is no page-wide editor.
  const companyEdit = useLeadCompanyEdit(lead, detail.setLead, detail.reload);
  const canConvert =
    canMutate &&
    lead !== null &&
    lead.status !== "CONVERTED" &&
    !lead.convertedCustomerProfileId &&
    crmCapabilityAllowsOwner(capabilities.convert, lead.ownerUserId);
  const convert = useLeadConvert(
    lead,
    detail.reload,
    canConvert,
    capabilities.opportunitiesCreate ?? null,
  );
  const canUpdate =
    canMutate &&
    lead !== null &&
    crmCapabilityAllowsOwner(capabilities.update, lead.ownerUserId);
  const canDelete =
    canMutate &&
    lead !== null &&
    lead.status !== "CONVERTED" &&
    crmCapabilityAllowsOwner(capabilities.delete, lead.ownerUserId);
  const canEditRecord = canUpdate && lead?.status !== "CONVERTED";

  const onCardSaved = useCallback(
    (nextLead: LeadDetail, nextCard: LeadDetailCard) => {
      detail.setLead(nextLead);
      detail.setCard(nextCard);
    },
    [detail],
  );
  const cardEdit = useLeadCardEdit(lead, canEditRecord, onCardSaved, detail.reload);
  const stageMove = useLeadStageMove(lead, detail.stages, canUpdate, detail.reload);
  // The stage a press asked for, held until the confirmation answers.
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

  // Delete Lead confirmation state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inline 4-tab Dossier Workspace state in Right Column
  const [activeInlineTab, setActiveInlineTab] = useState<DossierWorkspaceTab>("activities");
  const [visitedAttachments, setVisitedAttachments] = useState(false);

  const handleDeleteLead = async () => {
    if (!lead || !canDelete || deleting) return;
    setDeleting(true);
    try {
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "delete",
        path: leadPath(lead.id),
        parse: () => true,
      });
      if (outcome.kind === "success") {
        setConfirmDeleteOpen(false);
        if (typeof window !== "undefined") {
          window.location.assign("/crm/leads");
        }
      }
    } finally {
      setDeleting(false);
    }
  };

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (detail.isNotFound) {
    return (
      <NotFoundState
        title={t.crmLeadDetail.notFoundTitle}
        description={t.crmLeadDetail.notFoundDescription}
        backLabel={t.crmLeadDetail.backToLeads}
        backHref="/crm/leads"
      />
    );
  }

  if (detail.isForbidden) return <CrmScopeGate />;

  if (detail.error || !lead) {
    return (
      <ErrorState
        title={t.crmLeadDetail.loadFailed}
        description={describeError(detail.error) ?? undefined}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />
    );
  }

  const currentStage = detail.stages.find(({ id }) => id === lead.stageId) ?? null;
  const currentStageIndex = detail.stages.findIndex(({ id }) => id === lead.stageId);
  const pendingStage = detail.stages.find(({ id }) => id === pendingStageId) ?? null;
  const sourceLabel = localizedValue(
    lead.acquisitionSourceNameAr,
    lead.acquisitionSourceNameEn,
    lang,
  );
  const isCorporate = lead.leadProfileType === "CORPORATE";
  const isConverted = lead.status === "CONVERTED";
  const currentRating = detail.card?.rating ?? 0;
  const currentCardColor = detail.card?.cardColor ?? null;
  const stageAge = formatLeadStageAge(detail.card?.stageEnteredAt, now, lang);
  const locationParts = [lead.address?.city, lead.address?.country]
    .filter(Boolean)
    .join(", ");
  const formattedCreatedAt = formatDate(lead.createdAt, lang);
  const currentStageName = currentStage
    ? localizedValue(currentStage.nameAr, currentStage.nameEn, lang)
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Keep DetailHeader for screen-reader & test contract without portaling duplicate actions */}
      <DetailHeader
        className="sr-only"
        title={lead.displayName}
        subtitle={[
          t.crmCustomerProfiles.profileTypes[lead.leadProfileType],
          sourceLabel,
        ]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={lead.status} kind="LeadStatus" />}
        backLabel={t.crmLeadDetail.backToLeads}
        backHref="/crm/leads"
      />

      {/* Top Sub-Toolbar: Back to Leads + Breadcrumb + Delete Lead */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-muted-foreground">
          <Link href="/crm/leads" className="dossier-btn">
            <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
            <span>{t.crmLeadDetail.backToLeads}</span>
          </Link>
          <span aria-hidden="true">/</span>
          <span>CRM</span>
          <span aria-hidden="true">›</span>
          <span>{t.crmLeads.title}</span>
          <span aria-hidden="true">›</span>
          <span className="font-bold text-foreground">{lead.displayName}</span>
        </div>
        {canDelete && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="dossier-btn dossier-btn-cancel"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>{t.common.delete}</span>
            </button>
          </div>
        )}
      </div>

      {/* Standalone Full-Width Colorful Dossier Hero Header */}
      <div
        className={cn(
          "dossier-hero",
          isConverted && "dossier-hero-converted",
          cardColorBorder(currentCardColor),
        )}
      >
        <div className="dossier-hero-left">
          <span className={dossierAvatarClass(isCorporate, isConverted)}>
            {getInitials(lead.displayName)}
          </span>
          <div className="dossier-hero-meta">
            {/* Row 1: Display Name + Profile Type Pill + Status Pill + Stage Pill + Stage Age */}
            <div className="dossier-hero-row1">
              <h1 className="dossier-hero-name">{lead.displayName}</h1>
              <span
                className={cn(
                  "dossier-badge",
                  isCorporate ? "dossier-badge-corp" : "dossier-badge-indiv",
                )}
              >
                {isCorporate ? (
                  <Building2 className="size-3" aria-hidden="true" />
                ) : (
                  <UserRound className="size-3" aria-hidden="true" />
                )}
                <span>
                  {t.crmCustomerProfiles.profileTypes[lead.leadProfileType]}
                </span>
              </span>
              <span
                className={cn(
                  "dossier-badge",
                  isConverted
                    ? "dossier-badge-status-conv"
                    : "dossier-badge-status-open",
                )}
              >
                ● {isAr ? "الحالة" : "Status"}: {lead.status}
              </span>
              {currentStageName && (
                <span className="dossier-badge dossier-badge-stage">
                  {t.crmLeads.stage}: {currentStageName}
                </span>
              )}
              {stageAge && (
                <span className="dossier-badge dossier-badge-age">
                  ⏱ {formatTemplate(t.crmLeads.card.stageAge, { age: stageAge })}
                </span>
              )}
            </div>

            {/* Row 2: 3-Star Interactive Rating Pill + 6-Dot Card Color Picker (No Color first) */}
            <div className="dossier-hero-row2">
              <div
                role="group"
                aria-label={t.crmLeads.card.rating}
                className="dossier-rating-pill"
              >
                {[1, 2, 3].map((starIndex) => {
                  const active = starIndex <= currentRating;
                  return (
                    <button
                      key={starIndex}
                      type="button"
                      disabled={!canEditRecord || cardEdit.saving}
                      onClick={() =>
                        void cardEdit.save({
                          rating: currentRating === starIndex ? 0 : starIndex,
                        })
                      }
                      aria-label={formatTemplate(t.crmLeads.card.rateStars, {
                        count: starIndex,
                      })}
                      title={formatTemplate(t.crmLeads.card.rateStars, {
                        count: starIndex,
                      })}
                      className="rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
                    >
                      <Star
                        className={cn(
                          "size-3.5 transition-colors",
                          active
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-600",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
                <span className="ms-1 font-extrabold">{currentRating}/3</span>
              </div>

              <div
                role="group"
                aria-label={t.crmLeads.card.cardColor}
                className="dossier-color-pill"
              >
                <span className="dossier-color-label">
                  {t.crmLeads.card.cardColor}:
                </span>
                {DOSSIER_HEADER_CARD_COLORS.map((item) => {
                  const isSelected = currentCardColor === item.color;
                  const labelText =
                    item.color === null
                      ? t.crmLeads.card.colorNone
                      : t.crmLeads.card.colors[item.color];
                  return (
                    <button
                      key={item.color ?? "NONE"}
                      type="button"
                      disabled={!canEditRecord || cardEdit.saving}
                      onClick={() => {
                        if (!isSelected) void cardEdit.save({ cardColor: item.color });
                      }}
                      aria-label={labelText}
                      title={labelText}
                      style={
                        item.color !== null
                          ? { backgroundColor: item.hex }
                          : undefined
                      }
                      className={cn(
                        "dossier-color-dot transition-transform hover:scale-115 disabled:cursor-default disabled:hover:scale-100",
                        item.color === null && "none",
                        isSelected && "active",
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Row 3: Real Recorded Metadata Only (Zero Fake Data) */}
            {(locationParts || sourceLabel || formattedCreatedAt) && (
              <div className="dossier-hero-row3">
                {locationParts && <span>📍 {locationParts}</span>}
                {locationParts && sourceLabel && (
                  <span className="dossier-dot">·</span>
                )}
                {sourceLabel && (
                  <span>
                    🌐 {t.crmLeads.source}: <strong>{sourceLabel}</strong>
                  </span>
                )}
                {(locationParts || sourceLabel) && formattedCreatedAt && (
                  <span className="dossier-dot">·</span>
                )}
                {formattedCreatedAt && (
                  <span>
                    📅 {t.crmLeadDetail.createdAt}: {formattedCreatedAt}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Colorful Related Record KPI Pills + Convert Lead CTA */}
        <div className="dossier-hero-right">
          <LeadRelatedNav
            leadId={lead.id}
            partyId={lead.partyId}
            branchId={lead.branchId}
          />
          {(canConvert || convert.hasReceipt) && (
            <button
              type="button"
              onClick={convert.openModal}
              className="dossier-btn dossier-btn-primary"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>
                {convert.hasReceipt
                  ? t.crmLeadConvert.conversionResult
                  : `${t.crmLeadConvert.action} →`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Converted Read-Only Locked Banner (Case 6) */}
      {isConverted && (
        <div role="status" className="dossier-locked-banner">
          <div className="dossier-locked-banner-left">
            <span aria-hidden="true">🔒</span>
            <span>
              {isAr
                ? "تم تحويل هذا العميل المحتمل إلى ملف عميل نشط — السجل مقفل للقراءة فقط"
                : "Converted Lead — Record Locked (Read-Only)"}
            </span>
          </div>
          <div className="dossier-locked-links">
            {lead.convertedCustomerProfileId && (
              <Link
                href={`/crm/customer-profiles/${lead.convertedCustomerProfileId}`}
                className="dossier-locked-link"
              >
                <span>🏢 {isAr ? "فتح ملف العميل" : "Open Customer Profile"}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            {lead.convertedOpportunityId && (
              <Link
                href={`/crm/opportunities/${lead.convertedOpportunityId}`}
                className="dossier-locked-link"
              >
                <span>💼 {isAr ? "فتح الفرصة البيعية" : "Open Opportunity"}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Colorful 8-Stage Connected Pipeline Track */}
      {!detail.stagesDegraded && detail.stages.length > 0 && (
        <div className="dossier-stage-bar">
          <StageBar
            className="sr-only"
            label={t.crmLeads.stage}
            steps={detail.stages.map((entry) => ({
              id: entry.id,
              label: localizedValue(entry.nameAr, entry.nameEn, lang),
              tone: LEAD_STAGE_BAR_TONE[entry.flag],
              disabled: entry.flag === "CONVERTED",
            }))}
            value={lead.stageId}
            onChange={canUpdate ? (next) => next && setPendingStageId(next) : undefined}
            disabled={stageMove.isMoving}
          />
          <div className="dossier-stage-track">
            {detail.stages.map((entry, idx) => {
              const isCurrent = entry.id === lead.stageId;
              const isCompleted =
                currentStageIndex >= 0 && idx < currentStageIndex;
              const isDisqualified = entry.flag === "DISQUALIFIED";
              const isConvertedStage = entry.flag === "CONVERTED";
              const stageDisabled =
                !canEditRecord ||
                stageMove.isMoving ||
                isConvertedStage ||
                isCurrent;

              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={stageDisabled}
                  onClick={() => {
                    if (!isCurrent) setPendingStageId(entry.id);
                  }}
                  className={cn(
                    "dossier-stage-cell",
                    isCompleted && "completed",
                    isCurrent && !isConvertedStage && "current",
                    isDisqualified && !isCurrent && "disqualified",
                    isConvertedStage && (isCurrent ? "current converted" : "converted"),
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3 shrink-0" aria-hidden="true" />
                  ) : isCurrent ? (
                    <span aria-hidden="true">●</span>
                  ) : isDisqualified ? (
                    <span aria-hidden="true">✕</span>
                  ) : isConvertedStage ? (
                    <span aria-hidden="true">🔒</span>
                  ) : null}
                  <span className="truncate">
                    {localizedValue(entry.nameAr, entry.nameEn, lang)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={pendingStage !== null}
        onOpenChange={(next) => {
          if (!next) setPendingStageId(null);
        }}
        title={t.crmLeadDetail.moveStageTitle}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from: currentStage
            ? localizedValue(currentStage.nameAr, currentStage.nameEn, lang)
            : "—",
          to: pendingStage
            ? localizedValue(pendingStage.nameAr, pendingStage.nameEn, lang)
            : "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={stageMove.isMoving}
        onConfirm={() => {
          const target = pendingStageId;
          setPendingStageId(null);
          if (target) void stageMove.move(target);
        }}
      />

      <ConfirmActionModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t.common.delete}
        description={lead.displayName}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        loading={deleting}
        onConfirm={() => void handleDeleteLead()}
      />

      {stageMove.error && (
        <ErrorState
          title={stageMove.error}
          onRetry={stageMove.clearError}
          retryLabel={t.common.dismiss}
        />
      )}

      {detail.stagesDegraded && (
        <DegradedBanner message={t.crmLeads.stagesUnavailable} />
      )}
      {capabilitiesError && (
        <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />
      )}
      {sources.degraded && (
        <DegradedBanner message={t.crmLeadDetail.sourcesUnavailable} />
      )}

      {/* 100% Full-Width 2-Column Colorful Dossier Bento Grid */}
      <div className="dossier-grid">
        {/* LEFT COLUMN:
            - Corporate: Section 1 (Company Details) + Section 2 (Qualification & Custom Fields)
            - Individual: Section 1 (Personal & Contact Information) + Section 2 (Qualification & Custom Fields) */}
        <div className="dossier-col">
          {isCorporate ? (
            <div className="min-w-0">
              <LeadCompanyCard
                key={`company:${lead.id}`}
                lead={lead}
                edit={companyEdit}
                readOnly={!canUpdate || isConverted}
              />
              {companyEdit.error && (
                <div className="mt-2">
                  <ErrorState
                    title={describeError(companyEdit.error) ?? t.crmLeadDetail.saveFailed}
                    onRetry={companyEdit.clearError}
                    retryLabel={t.common.dismiss}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-0">
              <LeadContactsCard
                key={`contacts:${lead.id}`}
                lead={lead}
                canEdit={canUpdate}
                onSaved={detail.setLead}
                onReconcile={detail.reload}
              />
            </div>
          )}

          <div className="min-w-0">
            <LeadIdentityCards
              key={`details:${lead.id}`}
              lead={lead}
              canEdit={canUpdate}
              viewModeByDefault
              allowedOwnerIds={
                capabilities.update ? capabilities.update.ownerUserIds : []
              }
              sources={sources.items}
              onSaved={detail.setLead}
              onReconcile={detail.reload}
              customFieldsSlot={
                <CustomFieldsCard
                  density="compact"
                  branchId={lead.branchId}
                  ownerType="LEAD"
                  ownerId={lead.id}
                />
              }
            />
          </div>
        </div>

        {/* RIGHT COLUMN:
            - Corporate: Section 3 (Contact Persons) + Section 4 (Inline 4-Tab Workspace: Activities / Notes / Audit Log / Files)
            - Individual: Inline 4-Tab Workspace (Activities / Notes / Audit Log / Files) */}
        <div className="dossier-col">
          {isCorporate && (
            <div className="min-w-0">
              <LeadContactsCard
                key={`contacts:${lead.id}`}
                lead={lead}
                canEdit={canUpdate}
                onSaved={detail.setLead}
                onReconcile={detail.reload}
              />
            </div>
          )}

          {/* Inline 4-Tab Dossier Workspace Card (Activities / Notes / Audit Log / Files) */}
          <div className="dossier-card dossier-card-amber overflow-hidden">
            <div
              role="tablist"
              aria-label={`${lead.displayName} — ${t.activities.title} / ${t.crmLeadDetail.notes} / ${t.audit.historyTitle} / ${t.attachments.title}`}
              className="dossier-tabs"
            >
              {(
                [
                  {
                    id: "activities" as const,
                    label: t.activities.title,
                    Icon: ListTodo,
                  },
                  {
                    id: "notes" as const,
                    label: t.crmLeadDetail.notes,
                    Icon: FileText,
                  },
                  {
                    id: "history" as const,
                    label: t.audit.historyTitle,
                    Icon: History,
                  },
                  {
                    id: "attachments" as const,
                    label: t.attachments.title,
                    Icon: Paperclip,
                  },
                ] as const
              ).map(({ id, label, Icon }) => {
                const isActive = activeInlineTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveInlineTab(id);
                      if (id === "attachments") setVisitedAttachments(true);
                    }}
                    className={cn("dossier-tab", isActive && "active")}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="dossier-card-body">
              {activeInlineTab === "activities" && (
                <div role="tabpanel">
                  <RecordActivitiesPanel
                    target={{
                      app: "CRM",
                      type: "LEAD",
                      id: lead.id,
                      label: lead.displayName,
                    }}
                    readOnly={!canMutate || isConverted}
                  />
                </div>
              )}

              {activeInlineTab === "notes" && (
                <div role="tabpanel">
                  <RecordNotesSection
                    branchId={lead.branchId}
                    sourceType="LEAD"
                    sourceId={lead.id}
                    sourceOwnerUserId={lead.ownerUserId}
                    createCapability={capabilities.notesCreate ?? null}
                    deleteCapability={capabilities.notesDelete ?? null}
                    readOnly={!canMutate || isConverted}
                  />
                </div>
              )}

              {activeInlineTab === "history" && (
                <div role="tabpanel">
                  <EntityHistoryCard
                    density="compact"
                    entityType="Lead"
                    entityId={lead.id}
                    valueLabels={{
                      stageId: Object.fromEntries(
                        detail.stageCatalogue.map((stage) => [
                          stage.id,
                          localizedValue(stage.nameAr, stage.nameEn, lang),
                        ]),
                      ),
                    }}
                    relatedPartyIds={[
                      lead.partyId,
                      ...lead.contacts.map((contact) => contact.partyId),
                    ]}
                    refreshToken={lead}
                  />
                </div>
              )}

              {(visitedAttachments || activeInlineTab === "attachments") && (
                <div
                  role="tabpanel"
                  hidden={activeInlineTab !== "attachments"}
                >
                  <RecordAttachmentsSection
                    branchId={lead.branchId}
                    sourceType="LEAD"
                    sourceId={lead.id}
                    sourceOwnerUserId={lead.ownerUserId}
                    createCapability={capabilities.attachmentsCreate ?? null}
                    deleteCapability={capabilities.attachmentsDelete ?? null}
                    readOnly={!canMutate || isConverted}
                    uploadVariant="button"
                    density="compact"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LeadConvertModal convert={convert} />
    </div>
  );
}

