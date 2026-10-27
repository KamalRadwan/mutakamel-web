"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Building2,
  Check,
  FileText,
  History,
  ListTodo,
  Paperclip,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Button,
  DOSSIER_HEADER_CARD_COLORS,
  DegradedBanner,
  DetailHeader,
  ErrorState,
  NotFoundState,
  Skeleton,
  StatusBadge,
  cardColorBorder,
  cn,
  dossierAvatarClass,
  useToast,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
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
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import {
  parseCustomerProfileCardColor,
  parseCustomerProfileRating,
  type CustomerProfileCardPatch,
} from "../../customer-profile-card-contract";
import {
  BLACKLISTED_STATUS,
  CUSTOMER_STATUSES,
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import {
  customerProfilePath,
  type CustomerProfileStatus,
} from "../../hooks/useCustomerProfiles";
import { useCustomerProfilesCapabilities } from "../../hooks/useCustomerProfilesCapabilities";
import { useCustomerProfileActions } from "../hooks/useCustomerProfileActions";
import { useCustomerProfileDetail } from "../hooks/useCustomerProfileDetail";
import { CustomerCompanyCard } from "./CustomerCompanyCard";
import { CustomerContactsCard } from "./CustomerContactsCard";
import { CustomerProfileActionDialogs } from "./CustomerProfileActionDialogs";
import { CustomerProfileIdentityCard } from "./CustomerProfileIdentityCard";
import { CustomerProfileRelatedNav } from "./CustomerProfileRelatedNav";

type DossierWorkspaceTab = "activities" | "notes" | "history" | "attachments";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/**
 * Standalone 100% Full-Width Colorful Dossier 360° Customer Workspace.
 * Matches `LeadDetailWorkspace` in layout, visual hierarchy, and inline editing.
 */
export function CustomerProfileDetailWorkspace({
  profileId,
}: {
  profileId: string;
}) {
  const { t, lang } = useI18n();
  const canReadHistory = useAuditAccess();
  const router = useRouter();
  const { canMutate } = useAccessMode();
  const describeError = useCrmErrorText();
  const toast = useToast();

  const detail = useCustomerProfileDetail(profileId);
  const { capabilities, error: capabilitiesError } =
    useCustomerProfilesCapabilities(detail.profile?.branchId ?? null);
  const attached = useCrmRecordCapabilities(detail.profile?.branchId ?? null);
  const sources = useCrmAcquisitionSources();

  const [activeTab, setActiveTab] = useState<DossierWorkspaceTab>("activities");
  const [savingCardPatch, setSavingCardPatch] = useState(false);

  const actions = useCustomerProfileActions(
    detail.profile,
    detail.setProfile,
    () => router.push("/crm/customer-profiles"),
    detail.reload,
  );

  const backHref = "/crm/customer-profiles";

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <DetailHeader
          title={t.crmCustomerProfiles.detailTitle}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Skeleton className="h-80 w-full rounded-lg lg:col-span-6" />
          <Skeleton className="h-80 w-full rounded-lg lg:col-span-6" />
        </div>
      </div>
    );
  }

  if (detail.isNotFound) {
    return (
      <div className="space-y-4">
        <DetailHeader
          title={t.crmCustomerProfiles.detailTitle}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
        <NotFoundState
          title={t.crmCustomerProfileActions.notFoundTitle}
          description={t.crmCustomerProfileActions.notFoundDescription}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
      </div>
    );
  }

  if (detail.isForbidden) {
    return (
      <div className="space-y-4">
        <DetailHeader
          title={t.crmCustomerProfiles.detailTitle}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
        <CrmScopeGate />
      </div>
    );
  }

  if (detail.error || !detail.profile) {
    return (
      <div className="space-y-4">
        <DetailHeader
          title={t.crmCustomerProfiles.detailTitle}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
        <ErrorState
          title={t.crmCustomerProfiles.loadFailed}
          description={describeError(detail.error) ?? undefined}
          retryLabel={t.common.retry}
          onRetry={detail.reload}
        />
      </div>
    );
  }

  const profile: CustomerProfileDetail = detail.profile;
  const canEdit =
    canMutate &&
    crmCapabilityAllowsOwner(capabilities.update, profile.ownerUserId);
  const canDelete =
    canMutate &&
    crmCapabilityAllowsOwner(capabilities.delete, profile.ownerUserId);
  const canCreateActivity = canMutate && profile.status !== BLACKLISTED_STATUS;
  const allowedOwnerIds = capabilities.update
    ? capabilities.update.ownerUserIds
    : null;

  const isCorporate = profile.profileType === "CORPORATE";
  const currentRating = detail.card?.rating ?? 0;
  const currentColor = detail.card?.cardColor ?? null;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const locationParts = [profile.address?.city, profile.address?.country]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(", ");
  const sourceLabel = localizedValue(
    profile.acquisitionSourceNameAr,
    profile.acquisitionSourceNameEn,
    lang,
  );
  const formattedCreatedAt = profile.createdAt
    ? formatDate(profile.createdAt, lang)
    : "";

  const activeStatusIndex = CUSTOMER_STATUSES.indexOf(profile.status);
  const statusDisplayLabel =
    statusLabels[`CustomerStatus.${profile.status}`] ?? profile.status;

  const handleSaveCardPatch = async (patch: CustomerProfileCardPatch) => {
    if (!canEdit || savingCardPatch) return;
    setSavingCardPatch(true);
    try {
      const body: Record<string, unknown> = {};
      if (patch.rating !== undefined) body.rating = patch.rating;
      if (patch.cardColor !== undefined) body.cardColor = patch.cardColor;
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: customerProfilePath(profile.id),
        body,
        parse: (payload) => ({
          profile: parseCustomerProfileDetailResponse(payload),
          card: {
            rating: parseCustomerProfileRating(
              (payload as Record<string, unknown>)?.rating,
            ),
            cardColor: parseCustomerProfileCardColor(
              (payload as Record<string, unknown>)?.cardColor,
            ),
          },
        }),
      });
      if (outcome.kind === "success") {
        detail.setProfile(outcome.value.profile);
        detail.setCard?.(outcome.value.card);
      } else {
        toast.error(
          describeError(outcome.error) ?? t.crmCustomerProfiles.cardUpdateFailed,
        );
        if (outcome.kind !== "failed") detail.reload();
      }
    } finally {
      setSavingCardPatch(false);
    }
  };

  const handleStatusSelect = (status: CustomerProfileStatus) => {
    if (status === profile.status || !canEdit || actions.busy === "status") {
      return;
    }
    if (status === BLACKLISTED_STATUS) {
      actions.requestStatus(status);
    } else {
      void actions.submitStatus(status);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden semantic DetailHeader for contract compatibility */}
      <DetailHeader
        className="sr-only"
        title={profile.displayName}
        status={<StatusBadge value={profile.status} kind="CustomerStatus" />}
        backHref={backHref}
        backLabel={t.crmCustomerProfiles.back}
      />

      {/* Top Sub-Toolbar: Back to Customers + Breadcrumb + Delete Customer */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-muted-foreground">
          <Link href={backHref} className="dossier-btn">
            <ArrowLeft
              className="size-3.5 rtl:-scale-x-100"
              aria-hidden="true"
            />
            <span>{t.crmCustomerProfiles.back}</span>
          </Link>
          <span aria-hidden="true">/</span>
          <span>CRM</span>
          <span aria-hidden="true">›</span>
          <span>{t.crmCustomerProfiles.ui.detail.customerProfiles}</span>
          <span aria-hidden="true">›</span>
          <span className="font-semibold text-foreground">
            {profile.displayName}
          </span>
        </div>

        {canDelete && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={actions.requestDelete}
              className="dossier-btn dossier-btn-cancel"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>{t.common.delete}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Standalone Full-Width Colorful Dossier Hero Header */}
      <div className={cn("dossier-hero", cardColorBorder(currentColor))}>
        <div className="dossier-hero-left">
          <span className={dossierAvatarClass(isCorporate, false)}>
            {getInitials(profile.displayName)}
          </span>
          <div className="dossier-hero-meta">
            {/* Row 1: Display Name + Profile Type Pill + Status Pill + Source Lead Link */}
            <div className="dossier-hero-row1">
              <h1 className="dossier-hero-name">{profile.displayName}</h1>
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
                  {t.crmCustomerProfiles.profileTypes[profile.profileType] ??
                    profile.profileType}
                </span>
              </span>
              <span
                className={cn(
                  "dossier-badge",
                  profile.status === "ACTIVE_CUSTOMER"
                    ? "dossier-badge-status-conv"
                    : profile.status === BLACKLISTED_STATUS
                      ? "dossier-badge-status-disq"
                      : "dossier-badge-status-open",
                )}
              >
                ● {t.crmCustomerProfiles.ui.detail.status}: {statusDisplayLabel}
              </span>
              {profile.sourceLeadId && (
                <Link
                  href={`/crm/leads/${encodeURIComponent(profile.sourceLeadId)}`}
                  className="dossier-badge dossier-badge-status-conv hover:underline"
                >
                  <span>
                    {t.crmCustomerProfiles.ui.detail.convertedFromLead}
                  </span>
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* Row 2: 3-Star Interactive Rating Pill + 6-Dot Card Color Picker */}
            <div className="dossier-hero-row2">
              <div
                role="group"
                aria-label={t.crmLeads.card.rating}
                className="dossier-rating-pill"
              >
                {[1, 2, 3].map((starIndex) => {
                  const active = starIndex <= currentRating;
                  return (
                    <Button
                      key={starIndex}
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!canEdit || savingCardPatch}
                      onClick={() =>
                        void handleSaveCardPatch({
                          rating: currentRating === starIndex ? 0 : starIndex,
                        })
                      }
                      aria-label={formatTemplate(t.crmLeads.card.rateStars, {
                        count: starIndex,
                        max: 3,
                      })}
                      aria-pressed={active}
                      title={formatTemplate(t.crmLeads.card.rateStars, {
                        count: starIndex,
                        max: 3,
                      })}
                      className="h-auto rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
                    >
                      <Star
                        className={cn(
                          "size-3.5 transition-colors",
                          active
                            ? "fill-warning text-warning"
                            : "text-muted-foreground/40",
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  );
                })}
                <span className="ms-1 font-semibold">{currentRating}/3</span>
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
                  const isSelected = currentColor === item.color;
                  const labelText =
                    item.color === null
                      ? t.crmLeads.card.colorNone
                      : t.crmLeads.card.colors[item.color];
                  return (
                    <Button
                      key={item.color ?? "NONE"}
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!canEdit || savingCardPatch}
                      onClick={() => {
                        if (!isSelected) {
                          void handleSaveCardPatch({ cardColor: item.color });
                        }
                      }}
                      aria-label={labelText}
                      aria-pressed={isSelected}
                      title={labelText}
                      style={
                        item.color !== null
                          ? { backgroundColor: item.hex }
                          : undefined
                      }
                      className={cn(
                        "dossier-color-dot p-0 transition-transform hover:scale-115 disabled:cursor-default disabled:hover:scale-100",
                        item.color === null && "none",
                        isSelected && "active",
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Row 3: Real Recorded Metadata Only */}
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

        {/* Right Side: Related Commercial Documents KPI Pills */}
        <div className="dossier-hero-right">
          <CustomerProfileRelatedNav
            customerProfileId={profile.id}
            partyId={profile.partyId}
            branchId={profile.branchId}
          />
        </div>
      </div>

      {/* Blacklisted Customer Warning Banner */}
      {profile.status === BLACKLISTED_STATUS && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/35 bg-destructive-subtle px-4 py-2.5 text-xs"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-destructive-subtle-foreground">
            <Ban className="size-4" aria-hidden="true" />
            <span>
              {t.crmCustomerProfiles.ui.detail.blacklistedOpportunityWarning}
            </span>
          </span>
        </div>
      )}

      {/* Degraded / Error Banners */}
      {(capabilitiesError || attached.error) && (
        <DegradedBanner
          message={t.crmCustomerProfileActions.capabilitiesUnavailable}
        />
      )}
      {sources.degraded && (
        <DegradedBanner message={t.crmLeads.create.sourcesUnavailable} />
      )}
      {actions.error && (
        <p role="alert" className="text-xs text-destructive">
          {describeError(actions.error)}
        </p>
      )}

      {/* Colorful 4-Status Connected Pipeline Bar */}
      <div className="dossier-stage-bar">
        <div
          role="group"
          aria-label={t.crmCustomerProfileActions.changeStatus}
          className="dossier-stage-track"
        >
          {CUSTOMER_STATUSES.map((status, idx) => {
            const isCurrent = status === profile.status;
            const isPassed =
              activeStatusIndex >= 0 &&
              idx < activeStatusIndex &&
              status !== BLACKLISTED_STATUS;
            const isBlacklisted = status === BLACKLISTED_STATUS;
            const isActiveCustomer = status === "ACTIVE_CUSTOMER";
            const statusName =
              statusLabels[`CustomerStatus.${status}`] ?? status;

            return (
              <Button
                key={status}
                type="button"
                variant="ghost"
                size="xs"
                disabled={!canEdit || actions.busy === "status"}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => handleStatusSelect(status)}
                className={cn(
                  "dossier-stage-cell",
                  isPassed && "completed",
                  isCurrent && !isActiveCustomer && !isBlacklisted && "current",
                  isActiveCustomer &&
                    (isCurrent ? "current converted" : "converted"),
                  isBlacklisted && "disqualified",
                )}
              >
                {isPassed ? (
                  <Check className="size-3 shrink-0" aria-hidden="true" />
                ) : isCurrent ? (
                  <span aria-hidden="true">●</span>
                ) : isBlacklisted ? (
                  <span aria-hidden="true">✕</span>
                ) : null}
                <span className="truncate">{statusName}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* 100% Full-Width 2-Column Colorful Dossier Bento Grid */}
      <div className="dossier-grid">
        {/* Left Column: Corporate / Individual Contact + Account Identity & Custom Fields */}
        <div className="dossier-col">
          {isCorporate ? (
            <div className="min-w-0">
              <CustomerCompanyCard
                key={`company:${profile.id}`}
                profile={profile}
                onEdit={actions.openEdit}
                onSaved={detail.setProfile}
                onReconcile={detail.reload}
                readOnly={!canEdit}
              />
            </div>
          ) : (
            <div className="min-w-0">
              <CustomerContactsCard
                key={`individual-contact:${profile.id}`}
                profile={profile}
                canEdit={canEdit}
                onSaved={detail.setProfile}
                onReconcile={detail.reload}
              />
            </div>
          )}

          <div className="min-w-0">
            <CustomerProfileIdentityCard
              key={`identity:${profile.id}`}
              profile={profile}
              sources={sources.items}
              canEdit={canEdit}
              allowedOwnerIds={allowedOwnerIds}
              onSaved={detail.setProfile}
              onReconcile={detail.reload}
              viewModeByDefault
              customFieldsSlot={
                <CustomFieldsCard
                  density="compact"
                  branchId={profile.branchId}
                  ownerType="CUSTOMER_PROFILE"
                  ownerId={profile.id}
                />
              }
            />
          </div>
        </div>

        {/* Right Column: Corporate Contacts + Inline 4-Tab Workspace */}
        <div className="dossier-col">
          {isCorporate && (
            <div className="min-w-0">
              <CustomerContactsCard
                key={`contacts:${profile.id}`}
                profile={profile}
                canEdit={canEdit}
                onAddContact={actions.openContact}
                onSaved={detail.setProfile}
                onReconcile={detail.reload}
              />
            </div>
          )}

          {/* Inline 4-Tab Workspace Card: Activities, Notes, History, Attachments */}
          <div className="dossier-card dossier-card-amber overflow-hidden">
            <div
              className="dossier-tabs"
              role="tablist"
              aria-label={`${profile.displayName} — ${t.activities.title} / ${t.crmLeadDetail.notes} / ${t.audit.historyTitle} / ${t.attachments.title}`}
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
              ).filter(({ id }) => id !== "history" || canReadHistory).map(({ id, label, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    size="xs"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={cn("dossier-tab", isActive && "active")}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </Button>
                );
              })}
            </div>

            <div className="dossier-card-body">
              {activeTab === "activities" && (
                <div role="tabpanel">
                  <RecordActivitiesPanel
                    target={{
                      app: "CRM",
                      type: "CUSTOMER_PROFILE",
                      id: profile.id,
                      label: profile.displayName,
                    }}
                    readOnly={!canCreateActivity}
                  />
                </div>
              )}

              {activeTab === "notes" && (
                <div role="tabpanel">
                  <RecordNotesSection
                    branchId={profile.branchId}
                    sourceType="CUSTOMER_PROFILE"
                    sourceId={profile.id}
                    sourceOwnerUserId={profile.ownerUserId}
                    createCapability={attached.capabilities.notesCreate}
                    readOnly={!canMutate || profile.status === BLACKLISTED_STATUS}
                  />
                </div>
              )}

              {activeTab === "history" && (
                <div role="tabpanel">
                  <RecordHistoryTab
                    density="compact"
                    entityType="CustomerProfile"
                    entityId={profile.id}
                    relatedPartyIds={[
                      profile.partyId,
                      ...profile.contacts.map((contact) => contact.partyId),
                    ]}
                    refreshToken={profile}
                  />
                </div>
              )}

              {activeTab === "attachments" && (
                <div role="tabpanel">
                  <RecordAttachmentsSection
                    branchId={profile.branchId}
                    sourceType="CUSTOMER_PROFILE"
                    sourceId={profile.id}
                    sourceOwnerUserId={profile.ownerUserId}
                    createCapability={attached.capabilities.attachmentsCreate}
                    deleteCapability={attached.capabilities.attachmentsDelete}
                    readOnly={!canMutate || profile.status === BLACKLISTED_STATUS}
                    uploadVariant="button"
                    density="compact"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CustomerProfileActionDialogs
        actions={actions}
        sources={sources.items}
        displayName={profile.displayName}
      />
    </div>
  );
}
