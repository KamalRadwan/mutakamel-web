"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Building2,
  Calendar,
  Check,
  History,
  ListTodo,
  MapPin,
  Paperclip,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import {
  CARD_COLORS,
  DetailHeader,
  DegradedBanner,
  ErrorState,
  NotFoundState,
  Skeleton,
  StatusBadge,
  cn,
  type CardColor,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
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

const COLOR_DOT_HEX: Record<CardColor, string> = {
  RED: "#ef4444",
  ORANGE: "#f97316",
  AMBER: "#f59e0b",
  YELLOW: "#eab308",
  GREEN: "#22c55e",
  TEAL: "#14b8a6",
  BLUE: "#3b82f6",
  INDIGO: "#6366f1",
  PURPLE: "#a855f7",
  PINK: "#ec4899",
  SLATE: "#64748b",
};

type DossierWorkspaceTab = "activities" | "notes" | "history" | "attachments";

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
  const isAr = lang === "ar";
  const router = useRouter();
  const { canMutate } = useAccessMode();
  const describeError = useCrmErrorText();

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
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Skeleton className="h-80 w-full rounded-2xl lg:col-span-6" />
          <Skeleton className="h-80 w-full rounded-2xl lg:col-span-6" />
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
  const allowedOwnerIds = capabilities.update
    ? capabilities.update.ownerUserIds
    : null;

  const isCorporate = profile.profileType === "CORPORATE";
  const currentRating = detail.card?.rating ?? 0;
  const currentColor = detail.card?.cardColor ?? null;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const locationText = [profile.address?.country, profile.address?.city]
    .filter(Boolean)
    .join(" · ");
  const sourceLabel = localizedValue(
    profile.acquisitionSourceNameAr,
    profile.acquisitionSourceNameEn,
    lang,
  );
  const createdDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(
        isAr ? "ar-EG" : "en-GB",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : null;

  const activeStatusIndex = CUSTOMER_STATUSES.indexOf(profile.status);

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
      } else if (outcome.kind !== "failed") {
        detail.reload();
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
    <div className="w-full space-y-5 pb-10">
      {/* Hidden semantic DetailHeader for contract compatibility */}
      <div className="sr-only">
        <DetailHeader
          title={profile.displayName}
          backHref={backHref}
          backLabel={t.crmCustomerProfiles.back}
        />
      </div>

      {/* Top Sub-Toolbar: Back Link + Breadcrumb + Delete Customer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted"
          >
            <ArrowLeft
              className={cn("size-3.5", isAr && "rotate-180")}
              aria-hidden="true"
            />
            <span>{t.crmCustomerProfiles.back}</span>
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-medium text-muted-foreground">
            {isAr ? "ملفات العملاء" : "Customer Profiles"}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="max-w-xs truncate text-xs font-bold text-foreground">
            {profile.displayName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={actions.requestDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>{t.common.delete}</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone Full-Width Colorful Dossier Hero Header */}
      <div className="dossier-hero rounded-2xl border border-border shadow-xs">
        <div className="dossier-hero-main">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="dossier-avatar">
              {isCorporate ? (
                <Building2 className="size-6" aria-hidden="true" />
              ) : (
                <User className="size-6" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="dossier-title-row">
                <h1 className="dossier-title truncate">{profile.displayName}</h1>

                <span
                  className={cn(
                    "dossier-pill",
                    isCorporate
                      ? "dossier-pill-indigo"
                      : "dossier-pill-emerald",
                  )}
                >
                  {isCorporate ? (
                    <Building2 className="size-3" aria-hidden="true" />
                  ) : (
                    <User className="size-3" aria-hidden="true" />
                  )}
                  <span>
                    {t.crmCustomerProfiles.profileTypes[profile.profileType] ??
                      profile.profileType}
                  </span>
                </span>

                <StatusBadge value={profile.status} kind="CustomerStatus" />

                {/* Interactive 3-Star Rating Pill */}
                <div
                  role="group"
                  aria-label={t.crmLeads.card.rating}
                  className="dossier-rating-pill"
                >
                  {[1, 2, 3].map((star) => {
                    const active = star <= currentRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        disabled={!canEdit || savingCardPatch}
                        aria-label={formatTemplate(t.crmLeads.card.rateStars, {
                          count: star,
                          max: 3,
                        })}
                        aria-pressed={active}
                        onClick={() =>
                          void handleSaveCardPatch({
                            rating: currentRating === star ? 0 : star,
                          })
                        }
                        className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            active
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/35",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Card Color Dots Picker */}
                <div
                  role="group"
                  aria-label={t.crmLeads.card.cardColor}
                  className="flex items-center gap-1 rounded-full border border-border/80 bg-card/90 px-2 py-1"
                >
                  <button
                    type="button"
                    disabled={!canEdit || savingCardPatch}
                    aria-label={t.crmLeads.card.colorNone}
                    aria-pressed={currentColor === null}
                    title={t.crmLeads.card.colorNone}
                    onClick={() =>
                      void handleSaveCardPatch({ cardColor: null })
                    }
                    className={cn(
                      "relative size-3 rounded-full border border-muted-foreground/50 bg-transparent transition-transform hover:scale-125 disabled:opacity-50",
                      currentColor === null &&
                        "ring-2 ring-offset-1 ring-foreground scale-110",
                    )}
                  />
                  {CARD_COLORS.map((color) => {
                    const isSelected = currentColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        disabled={!canEdit || savingCardPatch}
                        aria-label={t.crmLeads.card.colors[color]}
                        aria-pressed={isSelected}
                        title={t.crmLeads.card.colors[color]}
                        onClick={() =>
                          void handleSaveCardPatch({
                            cardColor: isSelected ? null : color,
                          })
                        }
                        className={cn(
                          "size-3 rounded-full transition-transform hover:scale-125 disabled:opacity-50",
                          isSelected &&
                            "ring-2 ring-offset-1 ring-foreground scale-110",
                        )}
                        style={{ backgroundColor: COLOR_DOT_HEX[color] }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Clean Subtitle Row */}
              <div className="dossier-subtitle">
                {isCorporate &&
                  profile.companyName &&
                  profile.companyName !== profile.displayName && (
                    <span>{profile.companyName}</span>
                  )}
                {locationText && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden="true" />
                    <span>{locationText}</span>
                  </span>
                )}
                {sourceLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles
                      className="size-3 text-amber-500"
                      aria-hidden="true"
                    />
                    <span>{sourceLabel}</span>
                  </span>
                )}
                {createdDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" aria-hidden="true" />
                    <span>{createdDate}</span>
                  </span>
                )}
                {profile.sourceLeadId && (
                  <Link
                    href={`/crm/leads/${encodeURIComponent(profile.sourceLeadId)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <span>
                      {isAr ? "محوّل من عميل محتمل" : "Converted from Lead"}
                    </span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Related Commercial Documents KPI Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <CustomerProfileRelatedNav
              customerProfileId={profile.id}
              partyId={profile.partyId}
              branchId={profile.branchId}
            />
          </div>
        </div>
      </div>

      {/* Blacklisted Customer Warning Banner */}
      {profile.status === BLACKLISTED_STATUS && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-xs"
        >
          <span className="inline-flex items-center gap-2 font-bold text-red-700 dark:text-red-300">
            <Ban className="size-4" aria-hidden="true" />
            <span>
              {isAr
                ? "هذا العميل مدرج في القائمة السوداء — لا يمكن فتح فرص بيعية جديدة عليه."
                : "This customer is blacklisted — creating new sales opportunities on this account is blocked."}
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
      <div className="dossier-stage-bar rounded-2xl border border-border shadow-2xs">
        <div className="dossier-stage-label">
          <span>
            {isAr
              ? "مسار حالة العميل — انقر على أي حالة لتحديث حالة الحساب"
              : "Customer Account Status Pipeline — Click any status to transition"}
          </span>
          <span className="font-semibold text-foreground">
            {statusLabels[`CustomerStatus.${profile.status}`] ?? profile.status}
          </span>
        </div>

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
            const statusName =
              statusLabels[`CustomerStatus.${status}`] ?? status;

            let toneClass = "";
            if (isCurrent) {
              if (status === "ACTIVE_CUSTOMER") {
                toneClass = "dossier-stage-cell-converted";
              } else if (isBlacklisted) {
                toneClass = "dossier-stage-cell-Lost";
              } else {
                toneClass = "dossier-stage-cell-active";
              }
            } else if (isPassed) {
              toneClass = "dossier-stage-cell-done";
            }

            return (
              <button
                key={status}
                type="button"
                disabled={!canEdit || actions.busy === "status"}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => handleStatusSelect(status)}
                className={cn("dossier-stage-cell", toneClass)}
              >
                {isCurrent || isPassed ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : isBlacklisted ? (
                  <AlertTriangle
                    className="size-3 shrink-0 text-red-500/80"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-current/30 text-[10px]">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{statusName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Colorful Dossier Bento Grid */}
      <div className="dossier-grid">
        {/* Left Column: Corporate / Individual Contact + Account Identity & Custom Fields */}
        <div className="space-y-5 min-w-0">
          {isCorporate ? (
            <CustomerCompanyCard
              key={`company:${profile.id}`}
              profile={profile}
              onEdit={actions.openEdit}
              onSaved={detail.setProfile}
              onReconcile={detail.reload}
              readOnly={!canEdit}
            />
          ) : (
            <CustomerContactsCard
              key={`individual-contact:${profile.id}`}
              profile={profile}
              canEdit={canEdit}
              onSaved={detail.setProfile}
              onReconcile={detail.reload}
            />
          )}

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

        {/* Right Column: Corporate Contacts + Inline 4-Tab Workspace */}
        <div className="space-y-5 min-w-0">
          {isCorporate && (
            <CustomerContactsCard
              key={`contacts:${profile.id}`}
              profile={profile}
              canEdit={canEdit}
              onAddContact={actions.openContact}
              onSaved={detail.setProfile}
              onReconcile={detail.reload}
            />
          )}

          {/* Inline 4-Tab Workspace Card: Activities, Notes, History, Attachments */}
          <div className="dossier-card dossier-card-amber">
            <div className="dossier-tabs" role="tablist">
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
                    Icon: StickyNote,
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
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "dossier-tab",
                      isActive && "dossier-tab-active",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="dossier-card-body">
              {activeTab === "activities" && (
                <RecordActivitiesPanel
                  target={{
                    app: "CRM",
                    type: "CUSTOMER_PROFILE",
                    id: profile.id,
                    label: profile.displayName,
                  }}
                  readOnly={!canEdit}
                />
              )}

              {activeTab === "notes" && (
                <RecordNotesSection
                  branchId={profile.branchId}
                  sourceType="CUSTOMER_PROFILE"
                  sourceId={profile.id}
                  sourceOwnerUserId={profile.ownerUserId}
                  createCapability={attached.capabilities.notesCreate}
                  deleteCapability={attached.capabilities.notesDelete}
                  readOnly={!canEdit}
                />
              )}

              {activeTab === "history" && (
                <EntityHistoryCard
                  density="compact"
                  entityType="CustomerProfile"
                  entityId={profile.id}
                  relatedPartyIds={[
                    profile.partyId,
                    ...profile.contacts.map((contact) => contact.partyId),
                  ]}
                  refreshToken={profile}
                />
              )}

              {activeTab === "attachments" && (
                <RecordAttachmentsSection
                  branchId={profile.branchId}
                  sourceType="CUSTOMER_PROFILE"
                  sourceId={profile.id}
                  sourceOwnerUserId={profile.ownerUserId}
                  createCapability={attached.capabilities.attachmentsCreate}
                  deleteCapability={attached.capabilities.attachmentsDelete}
                  readOnly={!canEdit}
                  uploadVariant="button"
                  density="compact"
                />
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
