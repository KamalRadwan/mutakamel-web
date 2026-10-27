"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  DollarSign,
  ExternalLink,
  FileText,
  History,
  ListTodo,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Percent,
  Phone,
  Plus,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Trophy,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  ConfirmActionModal,
  CopyButton,
  DOSSIER_HEADER_CARD_COLORS,
  DateTime,
  DegradedBanner,
  DetailHeader,
  ErrorState,
  Input,
  Money,
  NotFoundState,
  PageActions,
  RatingStars,
  Skeleton,
  StageBar,
  StatusBadge,
  Textarea,
  cardColorBorder,
  cn,
  dossierAvatarClass,
  type CardColor,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import { UserProfileLink } from "@/components/people/UserProfileLink";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createWriteAttempt,
  expectNoContent,
  runIdempotentWrite,
  type WriteAttempt,
  type WriteOptions,
} from "@/lib/api/idempotent-write";
import { formatDate } from "@/lib/format/date";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreateTagModal } from "../../../leads/components/create-lead/CreateTagModal";
import { useCreateLeadTags } from "../../../leads/hooks/useCreateLeadTags";
import { formatLeadStageAge } from "../../../leads/lead-stage-age";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { parseCrmTags } from "../../../shared/tag-contract";
import { TerminalMoveDialog } from "../../components/TerminalMoveDialog";
import { useOpportunityCapabilities } from "../../hooks/useOpportunityCapabilities";
import { opportunityCapabilityAllowsOwner } from "../../hooks/usePipelineWorkspace";
import {
  opportunityPath,
  parseOpportunityDetailResponse,
} from "../../opportunity-contract";
import {
  buildUpdateOpportunityRequest,
  toOpportunityForm,
  type OpportunityForm,
  type UpdateOpportunityRequest,
} from "../../opportunity-write-contract";
import { useOpportunityCurrencyOptions } from "../../hooks/useCreateOpportunity";
import { useOpportunityDetail } from "../hooks/useOpportunityDetail";
import { useOpportunityEdit } from "../hooks/useOpportunityEdit";
import { useOpportunityStageMove } from "../hooks/useOpportunityStageMove";
import { usePipelineTransfer } from "../hooks/usePipelineTransfer";
import { OpportunityEditDrawer } from "./OpportunityEditDrawer";
import { OpportunityRelatedNav } from "./OpportunityRelatedNav";
import { PipelineTransferDialog } from "./PipelineTransferDialog";

const STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  WON: "positive",
  LOST: "negative",
};

type DossierWorkspaceTab = "activities" | "notes" | "history" | "attachments";

interface DetailWriteFeedback {
  operation: string;
  attempt: WriteAttempt;
  error: NormalizedApiError;
  replay?: () => Promise<void>;
}

const PROBABILITY_PRESETS = [10, 25, 50, 75, 90] as const;

function getInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function sanitizePhoneDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

/**
 * `/crm/opportunities/[id]` — Standalone 100% Full-Width Colorful Dossier 360° Workspace.
 * Matches `LeadDetailWorkspace` and `CustomerProfileDetailWorkspace` in layout,
 * visual hierarchy, interactive stage ribbon, inline editing, and 4-tab dossier panel.
 */
export function OpportunityDetailWorkspace({
  opportunityId,
}: {
  opportunityId: string;
}) {
  return (
    <OpportunityDetailContent key={opportunityId} opportunityId={opportunityId} />
  );
}

function OpportunityDetailContent({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const { t, lang } = useI18n();
  const canReadHistory = useAuditAccess();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const detail = useOpportunityDetail(opportunityId);
  const item = detail.item;
  const { capabilities, error: capabilitiesError } = useOpportunityCapabilities(
    item?.branchId ?? null,
  );
  const attached = useCrmRecordCapabilities(item?.branchId ?? null);
  const { canMutate } = useAccessMode();
  const [now] = useState(() => Date.now());

  const ownerPeople = useUserProfiles(
    item?.ownerUserId ? [item.ownerUserId] : [],
    Boolean(item?.ownerUserId),
    item ?? undefined,
  );

  const edit = useOpportunityEdit(item, detail.reload);
  const transfer = usePipelineTransfer(
    item,
    detail.pipelines,
    detail.reload,
  );

  const pipeline =
    detail.pipelines.find(({ id }) => id === item?.pipelineId) ?? null;
  const canUpdate =
    canMutate &&
    item !== null &&
    opportunityCapabilityAllowsOwner(capabilities.update, item.ownerUserId);
  const canDelete =
    canMutate &&
    item !== null &&
    opportunityCapabilityAllowsOwner(capabilities.delete, item.ownerUserId);

  const stageMove = useOpportunityStageMove(
    item,
    pipeline?.stages ?? [],
    canUpdate,
    detail.reload,
  );

  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Header quick-patch state (importance stars & card color & tags)
  const [savingQuickPatch, setSavingQuickPatch] = useState(false);
  const [quickPatchError, setQuickPatchError] =
    useState<NormalizedApiError | null>(null);
  const [writeFeedback, setWriteFeedback] =
    useState<DetailWriteFeedback | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const tagsCatalogue = useCreateLeadTags(true);

  // Inline Commercials Card edit state
  const [isEditingCommercials, setIsEditingCommercials] = useState(false);
  const currencyOptions = useOpportunityCurrencyOptions(isEditingCommercials);
  const [savingCommercials, setSavingCommercials] = useState(false);
  const [commercialsBaseline, setCommercialsBaseline] =
    useState<OpportunityForm | null>(null);
  const [commercialsError, setCommercialsError] =
    useState<NormalizedApiError | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftCurrency, setDraftCurrency] = useState("");
  const [draftProbability, setDraftProbability] = useState("");
  const [draftExpectedClose, setDraftExpectedClose] = useState("");
  const [draftImportance, setDraftImportance] = useState(2);
  const [draftDescription, setDraftDescription] = useState("");

  // Inline 4-tab Dossier Workspace state in Right Column
  const [activeInlineTab, setActiveInlineTab] =
    useState<DossierWorkspaceTab>("activities");
  const [visitedAttachments, setVisitedAttachments] = useState(false);

  const startEditingCommercials = () => {
    if (!item || !canUpdate || writeFeedback) return;
    setCommercialsBaseline(toOpportunityForm(item));
    setCommercialsError(null);
    setDraftTitle(item.title);
    setDraftAmount(item.amount ?? "");
    setDraftCurrency(item.currencyCode ?? "");
    setDraftProbability(
      item.probabilityPercent !== null ? String(item.probabilityPercent) : "",
    );
    setDraftExpectedClose(item.expectedCloseDate ?? "");
    setDraftImportance(item.importance);
    setDraftDescription(item.description ?? "");
    setIsEditingCommercials(true);
  };

  const writeDetailChange = async (
    options: Omit<WriteOptions<unknown>, "attempt">,
    setSaving: (saving: boolean) => void,
    setError: (error: NormalizedApiError | null) => void,
    onApplied?: () => void,
    operation: string = t.crmOpportunityDetail.editOperation,
  ) => {
    const attempt = createWriteAttempt();
    const send = async (): Promise<void> => {
      setSaving(true);
      setError(null);
      setWriteFeedback(null);
      try {
        const outcome = await runIdempotentWrite({ ...options, attempt });
        if (outcome.kind === "failed") {
          setError(outcome.error);
        } else if (outcome.kind === "ambiguous") {
          setWriteFeedback({ operation, attempt, error: outcome.error, replay: send });
        } else {
          if (outcome.kind === "applied_unreadable") {
            setWriteFeedback({ operation, attempt, error: outcome.error });
          }
          onApplied?.();
          // Commands return persisted entities; reload the enriched detail projection.
          detail.reload();
        }
      } finally {
        setSaving(false);
      }
    };
    await send();
  };

  const handleSaveCommercials = async () => {
    if (
      !item || !canUpdate || !commercialsBaseline ||
      savingCommercials || writeFeedback
    ) return;
    let body: UpdateOpportunityRequest;
    try {
      body = buildUpdateOpportunityRequest(
        {
          ...commercialsBaseline,
          title: draftTitle,
          amount: draftAmount,
          currencyCode: draftCurrency,
          probabilityPercent: draftProbability,
          expectedCloseDate: draftExpectedClose,
          importance: String(draftImportance),
          description: draftDescription,
        },
        commercialsBaseline,
      );
    } catch (caught) {
      setCommercialsError({
        status: 422,
        code: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    if (Object.keys(body).length === 0) {
      setIsEditingCommercials(false);
      return;
    }
    await writeDetailChange(
      {
        method: "patch",
        path: opportunityPath(item.id),
        body,
        parse: parseOpportunityDetailResponse,
      },
      setSavingCommercials,
      setCommercialsError,
      () => setIsEditingCommercials(false),
    );
  };

  const handleSaveImportance = async (nextImportance: number) => {
    if (!item || !canUpdate || savingQuickPatch || writeFeedback) return;
    const clamped = Math.max(0, Math.min(3, nextImportance));
    if (clamped === item.importance) return;
    await writeDetailChange(
      {
        method: "patch",
        path: opportunityPath(item.id),
        body: { importance: clamped },
        parse: parseOpportunityDetailResponse,
      },
      setSavingQuickPatch,
      setQuickPatchError,
    );
  };

  const handleSaveCardColor = async (nextColor: CardColor | null) => {
    if (!item || !canUpdate || savingQuickPatch || writeFeedback) return;
    await writeDetailChange(
      {
        method: "patch",
        path: opportunityPath(item.id),
        body: { cardColor: nextColor },
        parse: parseOpportunityDetailResponse,
      },
      setSavingQuickPatch,
      setQuickPatchError,
    );
  };

  const handleToggleTag = async (tagId: string, currentlyAttached: boolean) => {
    if (!item || !canUpdate || savingQuickPatch || writeFeedback) return;
    await writeDetailChange(
      currentlyAttached ? {
        method: "delete",
        path: `${opportunityPath(item.id)}/tags/${encodeURIComponent(tagId)}`,
        parse: expectNoContent,
      } : {
        method: "post",
        path: `${opportunityPath(item.id)}/tags`,
        body: { tagIds: [tagId] },
        parse: (payload) => parseCrmTags(payload),
      },
      setSavingQuickPatch,
      setQuickPatchError,
    );
  };

  const handleDeleteOpportunity = async () => {
    if (!item || !canDelete || deleting || writeFeedback) return;
    await writeDetailChange(
      {
        method: "delete",
        path: opportunityPath(item.id),
        parse: expectNoContent,
      },
      setDeleting,
      setQuickPatchError,
      () => {
        if (typeof window !== "undefined") {
          window.location.assign("/crm/opportunities");
        }
      },
      t.common.delete,
    );
    // Feedback lives in the workspace; dismiss the modal so it can be read.
    setConfirmDeleteOpen(false);
  };

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
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
        title={t.crmOpportunityDetail.notFoundTitle}
        description={t.crmOpportunityDetail.notFoundDescription}
        backLabel={t.crmOpportunityDetail.backToOpportunities}
        backHref="/crm/opportunities"
      />
    );
  }

  if (detail.isForbidden) return <CrmScopeGate />;

  if (detail.error || !item) {
    return (
      <ErrorState
        title={t.crmOpportunities.loadFailed}
        description={describeError(detail.error) ?? undefined}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />
    );
  }

  const currentStage =
    pipeline?.stages.find(({ id }) => id === item.stageId) ?? null;
  const currentStageIndex =
    pipeline?.stages.findIndex(({ id }) => id === item.stageId) ?? -1;
  const pendingStage =
    pipeline?.stages.find(({ id }) => id === pendingStageId) ?? null;
  const pendingTerminalStage =
    pendingStage?.flag === "WON" || pendingStage?.flag === "LOST"
      ? pendingStage
      : null;

  const loadedOwner = item.ownerUserId
    ? ownerPeople.profiles.get(item.ownerUserId)
    : undefined;
  const ownerResult =
    loadedOwner?.status === "loading" &&
    item.ownerUserId &&
    item.ownerDisplayName
      ? {
          status: "ready" as const,
          profile: {
            id: item.ownerUserId,
            fullName: item.ownerDisplayName,
            email: "",
            phone: null,
            imageUrl: null,
          },
        }
      : loadedOwner;

  const isWon = item.status === "WON" || item.stageFlag === "WON";
  const isLost = item.status === "LOST" || item.stageFlag === "LOST";
  const currentCardColor = item.cardColor ?? null;
  const stageAge = formatLeadStageAge(item.updatedAt, now, lang);
  const formattedCreatedAt = formatDate(item.createdAt, lang);
  const currentStageName = currentStage
    ? localizedName(currentStage, lang)
    : null;
  const pipelineName = pipeline ? localizedName(pipeline, lang) : null;
  const attachedTagIds = new Set(item.tags.map((tag) => tag.id));
  const primaryContactPhone =
    item.primaryContact?.phones[0] ?? item.customerPhone ?? null;
  const contactDigits = sanitizePhoneDigits(primaryContactPhone);
  const relatedPartyIds = [item.customerPartyId, item.contactPartyId].filter(
    (id): id is string => Boolean(id),
  );
  const stageLabels = Object.fromEntries(
    detail.pipelines.flatMap((entry) =>
      entry.stages.map((stage) => [stage.id, localizedName(stage, lang)]),
    ),
  );
  const pipelineLabels = Object.fromEntries(
    detail.pipelines.map((entry) => [entry.id, localizedName(entry, lang)]),
  );

  return (
    <div className="flex flex-col gap-3 pb-8">
      {quickPatchError && (
        <p role="alert" className="text-sm text-destructive">
          {describeError(quickPatchError)}
        </p>
      )}
      {writeFeedback && (
        <AmbiguousOutcomePanel
          operation={writeFeedback.operation}
          idempotencyKey={writeFeedback.attempt.idempotencyKey}
          description={
            writeFeedback.replay
              ? t.crmOpportunityDetail.ambiguousDescription
              : t.crmShared.appliedUnreadableDescription
          }
          correlationId={writeFeedback.error.correlationId}
          onRetry={() => {
            if (writeFeedback.replay) void writeFeedback.replay();
            else detail.reload();
          }}
          onDismiss={() => {
            setWriteFeedback(null);
            detail.reload();
          }}
          retrying={savingCommercials || savingQuickPatch || deleting}
          labels={writeFeedback.replay ? ambiguousLabels : appliedLabels}
        />
      )}
      <PageActions slot="related">
        <OpportunityRelatedNav item={item} />
      </PageActions>

      {canUpdate && (
        <PageActions slot="actions">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={edit.openDrawer}>
              {t.crmLeadDetail.edit}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={transfer.openDialog}
              disabled={detail.pipelines.length < 2}
            >
              {t.crmOpportunityDetail.transferAction}
            </Button>
          </div>
        </PageActions>
      )}

      {/* Keep DetailHeader for screen-reader & test contract compatibility */}
      <DetailHeader
        className="sr-only"
        title={item.title}
        subtitle={[pipelineName, currentStageName]
          .filter((part): part is string => Boolean(part && part.length > 0))
          .join(" · ")}
        status={<StatusBadge value={item.status} kind="OpportunityStatus" />}
        backLabel={t.crmOpportunityDetail.backToOpportunities}
        backHref="/crm/opportunities"
      />

      {/* Top Sub-Toolbar: Back to Opportunities + Breadcrumb + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-muted-foreground">
          <Link href="/crm/opportunities" className="dossier-btn">
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
            <span>{t.crmOpportunityDetail.backToOpportunities}</span>
          </Link>
          <span aria-hidden="true">/</span>
          <span>CRM</span>
          <span aria-hidden="true">›</span>
          <span>{t.crmOpportunities.title}</span>
          <span aria-hidden="true">›</span>
          <span className="max-w-xs truncate font-semibold text-foreground">
            {item.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={transfer.openDialog}
                disabled={detail.pipelines.length < 2}
                className="dossier-btn disabled:opacity-50"
              >
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                <span>{t.crmOpportunityDetail.transferAction}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={edit.openDrawer}
                className="dossier-btn"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                <span>{t.crmLeadDetail.edit}</span>
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="dossier-btn dossier-btn-cancel"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>{t.common.delete}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Standalone Full-Width Colorful Dossier Hero Header */}
      <div
        className={cn(
          "dossier-hero",
          isWon && "dossier-hero-converted",
          cardColorBorder(currentCardColor),
        )}
      >
        <div className="dossier-hero-left">
          <span className={dossierAvatarClass(true, isWon)}>
            {getInitials(item.title)}
          </span>

          <div className="dossier-hero-meta">
            {/* Row 1: Deal Title + Pipeline Badge + Status Badge + Stage Pill + Stage Age */}
            <div className="dossier-hero-row1">
              <h1 className="dossier-hero-name">{item.title}</h1>
              {pipelineName && (
                <span className="dossier-badge dossier-badge-corp">
                  <Sparkles className="size-3" aria-hidden="true" />
                  <span>{pipelineName}</span>
                </span>
              )}
              <span
                className={cn(
                  "dossier-badge",
                  isWon
                    ? "dossier-badge-status-conv"
                    : "dossier-badge-status-open",
                )}
              >
                ● {t.crmOpportunities.statusLabel}: {t.statusValues[`OpportunityStatus.${item.status}`]}
              </span>
              {currentStageName && (
                <span className="dossier-badge dossier-badge-stage">
                  {t.crmOpportunities.stage}: {currentStageName}
                </span>
              )}
              {stageAge && (
                <span className="dossier-badge dossier-badge-age">
                  ⏱ {formatTemplate(t.crmLeads.card.stageAge, { age: stageAge })}
                </span>
              )}
            </div>

            {/* Row 2: 3-Star Interactive Importance Pill + Card Color Picker + Tags */}
            <div className="dossier-hero-row2">
              <div
                role="group"
                aria-label={t.crmOpportunities.importance}
                className="dossier-rating-pill"
              >
                {[1, 2, 3].map((starIndex) => {
                  const active = starIndex <= item.importance;
                  return (
                    <Button
                      key={starIndex}
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!canUpdate || savingQuickPatch || Boolean(writeFeedback)}
                      onClick={() => void handleSaveImportance(
                        starIndex === item.importance ? 0 : starIndex,
                      )}
                      aria-pressed={starIndex === item.importance}
                      aria-label={formatTemplate(
                        t.crmOpportunities.importanceValue,
                        { level: starIndex === item.importance ? 0 : starIndex },
                      )}
                      title={formatTemplate(
                        t.crmOpportunities.importanceValue,
                        { level: starIndex === item.importance ? 0 : starIndex },
                      )}
                      className="h-auto w-auto rounded p-0.5 transition-transform hover:scale-110 hover:bg-transparent disabled:cursor-default disabled:hover:scale-100"
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
                <span className="ms-1 font-semibold">{item.importance}/3</span>
              </div>

              <div
                role="group"
                aria-label={t.crmLeads.card.cardColor}
                className="dossier-color-pill"
              >
                <span className="dossier-color-label">
                  {t.crmLeads.card.cardColor}:
                </span>
                {DOSSIER_HEADER_CARD_COLORS.map((swatch) => {
                  const isSelected = currentCardColor === swatch.color;
                  const labelText =
                    swatch.color === null
                      ? t.crmLeads.card.colorNone
                      : t.crmLeads.card.colors[swatch.color];
                  return (
                    <Button
                      key={swatch.color ?? "NONE"}
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!canUpdate || savingQuickPatch || writeFeedback !== null}
                      onClick={() => {
                        if (!isSelected) void handleSaveCardColor(swatch.color);
                      }}
                      aria-label={labelText}
                      title={labelText}
                      style={
                        swatch.color !== null
                          ? { backgroundColor: swatch.hex }
                          : undefined
                      }
                      className={cn(
                        "dossier-color-dot h-auto w-auto p-0 transition-transform hover:scale-115 disabled:cursor-default disabled:hover:scale-100",
                        swatch.color === null && "none",
                        isSelected && "active",
                      )}
                    />
                  );
                })}
              </div>

              {/* Attached Tags + Add Tag Popover */}
              <div className="relative flex flex-wrap items-center gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/90 px-2 py-0.5 text-2xs font-semibold text-foreground"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: tag.backgroundColor || "#6366f1",
                      }}
                    />
                    <span>{tag.name}</span>
                    {canUpdate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => void handleToggleTag(tag.id, true)}
                        disabled={savingQuickPatch || writeFeedback !== null}
                        className="ms-0.5 h-auto w-auto rounded-full p-0.5 text-muted-foreground hover:bg-transparent hover:text-destructive"
                        aria-label={`Remove ${tag.name}`}
                      >
                        <X className="size-2.5" />
                      </Button>
                    )}
                  </span>
                ))}
                {canUpdate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setTagMenuOpen((prev) => !prev)}
                    className="inline-flex h-auto items-center gap-1 rounded-full border border-dashed border-border bg-card/80 px-2 py-0.5 text-2xs font-semibold text-muted-foreground hover:border-foreground/40 hover:bg-card hover:text-foreground"
                  >
                    <Tag className="size-3" aria-hidden="true" />
                    <span>+ {t.crmOpportunities.tag}</span>
                  </Button>
                )}

                {tagMenuOpen && canUpdate && (
                  <div className="absolute top-full start-0 z-(--z-dropdown) mt-1.5 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <span className="text-2xs font-semibold text-muted-foreground">
                        {t.crmOpportunities.manageTags}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setTagMenuOpen(false)}
                        className="h-auto w-auto rounded p-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {tagsCatalogue.items.map((tag) => {
                        const attachedTag = attachedTagIds.has(tag.id);
                        return (
                          <Button
                            key={tag.id}
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={savingQuickPatch || writeFeedback !== null}
                            onClick={() =>
                              void handleToggleTag(tag.id, attachedTag)
                            }
                            className={cn(
                              "flex h-auto w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
                              attachedTag && "bg-primary/10 font-semibold",
                            )}
                          >
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    tag.backgroundColor || "#6366f1",
                                }}
                              />
                              <span className="truncate">{tag.name}</span>
                            </span>
                            {attachedTag && (
                              <Check className="size-3.5 text-primary" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    {tagsCatalogue.canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setTagMenuOpen(false);
                          setCreateTagOpen(true);
                        }}
                        className="mt-1.5 flex h-auto w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-2xs font-semibold text-primary hover:bg-primary/5"
                      >
                        <Plus className="size-3" />
                        <span>
                          {t.crmOpportunities.createTag}
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Customer Link + Lead Source + Created Date + Converted Lead Link */}
            <div className="dossier-hero-row3">
              <Link
                href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
                className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary hover:underline"
              >
                <Building2 className="size-3.5 text-swatch-indigo" aria-hidden="true" />
                <span>
                  {item.customerDisplayName ?? t.crmOpportunities.viewCustomer}
                </span>
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
              {item.leadSourceName && (
                <>
                  <span className="dossier-dot">·</span>
                  <span>
                    🌐 {t.crmLeads.source}:{" "}
                    <strong>{item.leadSourceName}</strong>
                  </span>
                </>
              )}
              {formattedCreatedAt && (
                <>
                  <span className="dossier-dot">·</span>
                  <span>
                    📅 {t.crmLeadDetail.createdAt}: {formattedCreatedAt}
                  </span>
                </>
              )}
              {item.leadId && (
                <>
                  <span className="dossier-dot">·</span>
                  <Link
                    href={`/crm/leads/${encodeURIComponent(item.leadId)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-subtle px-2 py-0.5 text-2xs font-semibold text-success-subtle-foreground hover:bg-success-subtle/80"
                  >
                    <span>
                      {t.crmOpportunities.originLead}
                    </span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Related Commercial Documents KPI Pills */}
        <div className="dossier-hero-right">
          <OpportunityRelatedNav item={item} />
        </div>
      </div>

      {/* Executive 4-KPI Deal Commercial Strip */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded-lg border border-swatch-indigo/25 bg-swatch-indigo/5 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
            <span>{t.crmOpportunityDetail.amount}</span>
            <DollarSign className="size-3.5 text-swatch-indigo" aria-hidden="true" />
          </div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {item.amount ? (
              <Money
                value={item.amount}
                currency={item.currencyCode ?? undefined}
              />
            ) : (
              <span className="text-muted-foreground">
                {t.detail.notRecorded}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-success/25 bg-success-subtle/40 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
            <span>{t.crmOpportunityDetail.probability}</span>
            <Percent className="size-3.5 text-success" aria-hidden="true" />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {item.probabilityPercent === null
                ? t.detail.notRecorded
                : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
                    percent: item.probabilityPercent,
                  })}
            </span>
            {item.probabilityPercent !== null && (
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-success/20">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.probabilityPercent))}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-warning/25 bg-warning-subtle/40 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
            <span>{t.crmOpportunities.expectedClose}</span>
            <Calendar className="size-3.5 text-warning" aria-hidden="true" />
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {item.expectedCloseDate ? (
              <DateTime value={item.expectedCloseDate} precision="date" />
            ) : (
              <span className="text-muted-foreground">
                {t.detail.notRecorded}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-info/25 bg-info-subtle/40 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
            <span>{t.crmOpportunities.owner}</span>
            <UserRound className="size-3.5 text-info" aria-hidden="true" />
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {item.ownerUserId ? (
              <UserProfileLink
                result={ownerResult}
                onRetry={ownerPeople.retry}
              />
            ) : (
              <span className="text-muted-foreground">
                {t.detail.notRecorded}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Won / Lost Outcome Banner */}
      {(isWon || isLost) && (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-xs",
            isWon
              ? "border-success/35 bg-success-subtle text-success-subtle-foreground"
              : "border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground",
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {isWon ? (
              <Trophy className="size-4 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 text-destructive" aria-hidden="true" />
            )}
            <span>
              {isWon
                ? t.crmOpportunities.opportunityWon
                : t.crmOpportunities.opportunityLost}
            </span>
            {isLost && item.lostReason && (
              <span className="font-normal">
                — {t.crmOpportunityDetail.lostReason}:{" "}
                <strong>{item.lostReason}</strong>
              </span>
            )}
          </div>
          <div className="text-2xs font-medium">
            {isWon && item.wonAt && (
              <span>
                {t.crmOpportunityDetail.wonAt}:{" "}
                <DateTime value={item.wonAt} precision="datetime" />
              </span>
            )}
            {isLost && item.lostAt && (
              <span>
                {t.crmOpportunityDetail.lostAt}:{" "}
                <DateTime value={item.lostAt} precision="datetime" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Colorful Connected Stage Pipeline Track */}
      {pipeline && pipeline.stages.length > 0 && (
        <div className="dossier-stage-bar">
          <StageBar
            className="sr-only"
            label={t.crmOpportunities.stage}
            steps={pipeline.stages.map((entry) => ({
              id: entry.id,
              label: localizedName(entry, lang),
              tone: STAGE_BAR_TONE[entry.flag],
            }))}
            value={item.stageId}
            onChange={
              canUpdate ? (next) => next && setPendingStageId(next) : undefined
            }
            disabled={stageMove.isMoving}
          />
          <div className="dossier-stage-track">
            {pipeline.stages.map((entry, idx) => {
              const isCurrent = entry.id === item.stageId;
              const isCompleted =
                currentStageIndex >= 0 &&
                idx < currentStageIndex &&
                entry.flag !== "LOST";
              const isLostStage = entry.flag === "LOST";
              const isWonStage = entry.flag === "WON";
              const stageDisabled =
                !canUpdate || stageMove.isMoving || isCurrent;

              return (
                <Button
                  key={entry.id}
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={stageDisabled}
                  onClick={() => {
                    if (!isCurrent) setPendingStageId(entry.id);
                  }}
                  className={cn(
                    "dossier-stage-cell",
                    isCompleted && "completed",
                    isCurrent && !isWonStage && !isLostStage && "current",
                    isLostStage && (isCurrent ? "current disqualified" : "disqualified"),
                    isWonStage && (isCurrent ? "current converted" : "converted"),
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3 shrink-0" aria-hidden="true" />
                  ) : isCurrent ? (
                    <span aria-hidden="true">●</span>
                  ) : isLostStage ? (
                    <span aria-hidden="true">✕</span>
                  ) : isWonStage ? (
                    <span aria-hidden="true">★</span>
                  ) : null}
                  <span className="truncate">{localizedName(entry, lang)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={pendingStage !== null && pendingTerminalStage === null}
        onOpenChange={(next) => {
          if (!next) setPendingStageId(null);
        }}
        title={t.crmLeadDetail.moveStageTitle}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from: currentStage ? localizedName(currentStage, lang) : "—",
          to: pendingStage ? localizedName(pendingStage, lang) : "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={stageMove.isMoving}
        onConfirm={async () => {
          const target = pendingStageId;
          setPendingStageId(null);
          if (target) await stageMove.move(target);
        }}
      />

      <TerminalMoveDialog
        key={
          pendingTerminalStage
            ? `${item.id}:${pendingTerminalStage.id}`
            : "closed"
        }
        isOpen={pendingTerminalStage !== null}
        onClose={() => {
          setPendingStageId(null);
          stageMove.clearError();
        }}
        opportunity={pendingTerminalStage ? item : null}
        targetFlag={pendingTerminalStage?.flag ?? "WON"}
        onConfirm={async (reason) => {
          if (!pendingTerminalStage) return false;
          const moved = await stageMove.move(pendingTerminalStage.id, reason);
          if (moved) setPendingStageId(null);
          return moved;
        }}
        isSubmitting={stageMove.isMoving}
        error={pendingTerminalStage ? stageMove.error : null}
      />

      <ConfirmActionModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t.common.delete}
        description={item.title}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        loading={deleting}
        onConfirm={() => void handleDeleteOpportunity()}
      />

      {stageMove.error && !pendingTerminalStage && (
        <ErrorState
          title={stageMove.error}
          onRetry={stageMove.clearError}
          retryLabel={t.common.dismiss}
        />
      )}

      {detail.degraded.pipelines && (
        <DegradedBanner message={t.crmOpportunityDetail.pipelinesUnavailable} />
      )}
      {capabilitiesError && (
        <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />
      )}
      {attached.error && (
        <DegradedBanner message={t.crmOpportunityDetail.attachedUnavailable} />
      )}

      {/* 100% Full-Width 2-Column Colorful Dossier Bento Grid */}
      <div className="dossier-grid">
        {/* LEFT COLUMN:
            - Card 1: Deal Commercials & Scope (with inline View/Edit mode)
            - Card 2: Customer Account, Primary Contact & Record Metadata + Custom Fields */}
        <div className="dossier-col">
          {/* Card 1: Deal Commercials & Scope */}
          <div className="dossier-card dossier-card-indigo">
            <div className="dossier-card-header">
              <div className="dossier-card-title">
                <DollarSign
                  className="size-4 text-swatch-indigo"
                  aria-hidden="true"
                />
                <span>{t.crmOpportunityDetail.factsTitle}</span>
              </div>
              {canUpdate && !isEditingCommercials && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={writeFeedback !== null}
                  onClick={startEditingCommercials}
                  className="dossier-btn"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                  <span>{t.crmLeadDetail.edit}</span>
                </Button>
              )}
            </div>

            <div className="dossier-card-body">
              {isEditingCommercials ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t.crmOpportunities.title}
                    </label>
                    <Input
                      size="sm"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      maxLength={180}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        {t.crmOpportunityDetail.amount}
                      </label>
                      <Input
                        size="sm"
                        value={draftAmount}
                        onChange={(e) => setDraftAmount(e.target.value)}
                        inputMode="decimal"
                        dir="ltr"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        {t.crmLeadConvert.currencyCode}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          size="sm"
                          aria-label={t.crmLeadConvert.currencyCode}
                          value={draftCurrency}
                          onChange={(e) =>
                            setDraftCurrency(e.target.value.toUpperCase())
                          }
                          maxLength={3}
                          dir="ltr"
                          className="w-20"
                        />
                        <div className="flex flex-wrap gap-1">
                          {currencyOptions.map((curr) => (
                            <Button
                              key={curr}
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setDraftCurrency(curr)}
                              className={cn(
                                "h-auto rounded border px-1.5 py-0.5 text-2xs font-semibold transition-colors",
                                draftCurrency === curr
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {curr}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        {t.crmOpportunityDetail.probability} (%)
                      </label>
                      <div className="space-y-1.5">
                        <Input
                          size="sm"
                          value={draftProbability}
                          onChange={(e) => setDraftProbability(e.target.value)}
                          inputMode="numeric"
                          maxLength={3}
                          dir="ltr"
                        />
                        <div className="flex flex-wrap gap-1">
                          {PROBABILITY_PRESETS.map((pct) => (
                            <Button
                              key={pct}
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setDraftProbability(String(pct))}
                              className={cn(
                                "h-auto rounded border px-1.5 py-0.5 text-2xs font-semibold transition-colors",
                                draftProbability === String(pct)
                                  ? "border-success bg-success-subtle text-success-subtle-foreground"
                                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        {t.crmOpportunities.expectedClose}
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={draftExpectedClose}
                        onChange={(e) => setDraftExpectedClose(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t.crmOpportunities.importance}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3].map((lvl) => (
                        <Button
                          key={lvl}
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setDraftImportance(lvl)}
                          className={cn(
                            "inline-flex h-auto items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                            draftImportance === lvl
                              ? "border-warning/50 bg-warning-subtle text-warning-subtle-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Star
                            className={cn(
                              "size-3.5",
                              lvl <= draftImportance
                                ? "fill-warning text-warning"
                                : "text-muted-foreground/40",
                            )}
                          />
                          <span>{lvl}★</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t.crmLeadDetail.description}
                    </label>
                    <Textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      maxLength={2000}
                      rows={3}
                    />
                  </div>

                  {commercialsError && (
                    <p role="alert" className="text-sm text-destructive">
                      {describeError(commercialsError)}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={savingCommercials}
                      onClick={() => setIsEditingCommercials(false)}
                      className="dossier-btn"
                    >
                      {t.common.cancel}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={savingCommercials || writeFeedback !== null}
                      onClick={() => void handleSaveCommercials()}
                      className="dossier-btn dossier-btn-primary"
                    >
                      {t.common.save}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunities.title}
                    </span>
                    <span className="dossier-field-value font-semibold">
                      {item.title}
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunityDetail.amount}
                    </span>
                    <span className="dossier-field-value font-semibold">
                      {item.amount ? (
                        <Money
                          value={item.amount}
                          currency={item.currencyCode ?? undefined}
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {t.detail.notRecorded}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunities.importance}
                    </span>
                    <span className="dossier-field-value inline-flex items-center gap-2">
                      <RatingStars
                        value={item.importance}
                        max={3}
                        label={formatTemplate(
                          t.crmOpportunities.importanceValue,
                          { level: item.importance },
                        )}
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatTemplate(t.crmOpportunities.importanceValue, {
                          level: item.importance,
                        })}
                      </span>
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunityDetail.probability}
                    </span>
                    <span className="dossier-field-value font-semibold">
                      {item.probabilityPercent === null
                        ? t.detail.notRecorded
                        : formatTemplate(
                            t.crmOpportunityDetail.probabilityValue,
                            { percent: item.probabilityPercent },
                          )}
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunities.expectedClose}
                    </span>
                    <span className="dossier-field-value">
                      {item.expectedCloseDate ? (
                        <DateTime
                          value={item.expectedCloseDate}
                          precision="date"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {t.detail.notRecorded}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmLeadDetail.stageFlag}
                    </span>
                    <span className="dossier-field-value">
                      {item.stageFlag ? (
                        <StatusBadge
                          value={item.stageFlag}
                          kind="OpportunityStageFlag"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {t.detail.notRecorded}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="dossier-field sm:col-span-2">
                    <span className="dossier-field-label">
                      {t.crmLeadDetail.description}
                    </span>
                    <p className="dossier-field-value whitespace-pre-wrap text-xs leading-relaxed">
                      {item.description || (
                        <span className="text-muted-foreground">
                          {t.detail.notRecorded}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Customer Account, Primary Contact & Instant Reach + Record Metadata */}
          <div className="dossier-card dossier-card-emerald">
            <div className="dossier-card-header">
              <div className="dossier-card-title">
                <Building2
                  className="size-4 text-success"
                  aria-hidden="true"
                />
                <span>{t.crmLeadDetail.ownershipTitle}</span>
              </div>
              <Link
                href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
                className="dossier-btn"
              >
                <span>{t.crmOpportunities.viewCustomer}</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="dossier-card-body space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="dossier-field">
                  <span className="dossier-field-label">
                    {t.crmOpportunities.customer}
                  </span>
                  <Link
                    href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
                    className="dossier-field-value inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <span>
                      {item.customerDisplayName ??
                        t.crmOpportunities.viewCustomer}
                    </span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="dossier-field">
                  <span className="dossier-field-label">
                    {t.crmOpportunities.owner}
                  </span>
                  <span className="dossier-field-value">
                    {item.ownerUserId ? (
                      <UserProfileLink
                        result={ownerResult}
                        onRetry={ownerPeople.retry}
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {t.detail.notRecorded}
                      </span>
                    )}
                  </span>
                </div>

                <div className="dossier-field">
                  <span className="dossier-field-label">
                    {t.crmLeads.contact}
                  </span>
                  <span className="dossier-field-value">
                    {item.primaryContact ? (
                      [
                        item.primaryContact.displayName,
                        item.primaryContact.jobTitle,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    ) : (
                      <span className="text-muted-foreground">
                        {t.detail.notRecorded}
                      </span>
                    )}
                  </span>
                </div>

                <div className="dossier-field">
                  <span className="dossier-field-label">
                    {t.crmLeads.source}
                  </span>
                  <span className="dossier-field-value">
                    {item.leadSourceName || (
                      <span className="text-muted-foreground">
                        {t.detail.notRecorded}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Primary Contact Direct Reach Channels */}
              {(primaryContactPhone || item.primaryContact?.email || item.customerEmail) && (
                  <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                    <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.crmOpportunities.directContactChannels}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {primaryContactPhone && (
                        <>
                          <a
                            href={`tel:${primaryContactPhone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                          >
                            <Phone
                              className="size-3.5 text-success"
                              aria-hidden="true"
                            />
                            <span dir="ltr">{primaryContactPhone}</span>
                          </a>
                          {contactDigits.length >= 6 && (
                            <>
                              <a
                                href={`https://wa.me/${contactDigits}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-success/30 bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success-subtle-foreground hover:bg-success-subtle/80"
                              >
                                <MessageCircle
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                <span>WhatsApp</span>
                              </a>
                              <a
                                href={`https://t.me/+${contactDigits}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-info/30 bg-info-subtle px-2.5 py-1 text-xs font-semibold text-info-subtle-foreground hover:bg-info-subtle/80"
                              >
                                <Send className="size-3.5" aria-hidden="true" />
                                <span>Telegram</span>
                              </a>
                            </>
                          )}
                        </>
                      )}

                      {(item.primaryContact?.email ?? item.customerEmail) && (
                        <a
                          href={`mailto:${item.primaryContact?.email ?? item.customerEmail}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          <Mail
                            className="size-3.5 text-swatch-indigo"
                            aria-hidden="true"
                          />
                          <span dir="ltr">
                            {item.primaryContact?.email ?? item.customerEmail}
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

              {/* Record Metadata */}
              <div className="border-t border-border/60 pt-3">
                <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.crmLeadDetail.recordTitle}
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmOpportunityDetail.opportunityId}
                    </span>
                    <span className="dossier-field-value flex items-center gap-1">
                      <span className="wrap-anywhere font-mono text-xs tabular-nums" dir="ltr">
                        {item.id}
                      </span>
                      <CopyButton
                        value={item.id}
                        copyLabel={t.crmShared.copyId}
                        copiedLabel={t.crmShared.copied}
                        failedLabel={t.crmShared.copyFailed}
                      />
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmLeadDetail.createdAt}
                    </span>
                    <span className="dossier-field-value">
                      <DateTime value={item.createdAt} precision="datetime" />
                    </span>
                  </div>

                  <div className="dossier-field">
                    <span className="dossier-field-label">
                      {t.crmLeadDetail.updatedAt}
                    </span>
                    <span className="dossier-field-value">
                      <DateTime value={item.updatedAt} precision="datetime" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <CustomFieldsCard
                density="compact"
                branchId={item.branchId}
                ownerType="OPPORTUNITY"
                ownerId={item.id}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN:
            - Inline 4-Tab Dossier Workspace Card (Activities / Notes / Audit Log / Files) */}
        <div className="dossier-col">
          <div className="dossier-card dossier-card-amber overflow-hidden">
            <div
              role="tablist"
              aria-label={`${item.title} — ${t.activities.title} / ${t.crmLeadDetail.notes} / ${t.audit.historyTitle} / ${t.attachments.title}`}
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
              ).filter(({ id }) => id !== "history" || canReadHistory).map(({ id, label, Icon }) => {
                const isActive = activeInlineTab === id;
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    size="xs"
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
                  </Button>
                );
              })}
            </div>

            <div className="dossier-card-body">
              {activeInlineTab === "activities" && (
                <div role="tabpanel">
                  <RecordActivitiesPanel
                    target={{
                      app: "CRM",
                      type: "OPPORTUNITY",
                      id: item.id,
                      label: item.title,
                    }}
                    readOnly={!canMutate}
                  />
                </div>
              )}

              {activeInlineTab === "notes" && (
                <div role="tabpanel">
                  <RecordNotesSection
                    branchId={item.branchId}
                    sourceType="OPPORTUNITY"
                    sourceId={item.id}
                    sourceOwnerUserId={item.ownerUserId}
                    createCapability={attached.capabilities.notesCreate}
                    readOnly={!canMutate}
                  />
                </div>
              )}

              {activeInlineTab === "history" && (
                <div role="tabpanel">
                  <RecordHistoryTab
                    density="compact"
                    entityType="Opportunity"
                    entityId={item.id}
                    relatedPartyIds={relatedPartyIds}
                    refreshToken={item}
                    valueLabels={{
                      stageId: stageLabels,
                      pipelineId: pipelineLabels,
                    }}
                  />
                </div>
              )}

              {(visitedAttachments || activeInlineTab === "attachments") && (
                <div
                  role="tabpanel"
                  hidden={activeInlineTab !== "attachments"}
                >
                  <RecordAttachmentsSection
                    branchId={item.branchId}
                    sourceType="OPPORTUNITY"
                    sourceId={item.id}
                    sourceOwnerUserId={item.ownerUserId}
                    createCapability={attached.capabilities.attachmentsCreate}
                    deleteCapability={attached.capabilities.attachmentsDelete}
                    readOnly={!canMutate}
                    uploadVariant="button"
                    density="compact"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <OpportunityEditDrawer edit={edit} />
      <PipelineTransferDialog transfer={transfer} />
      <CreateTagModal
        open={createTagOpen}
        existingTags={tagsCatalogue.items}
        onClose={() => setCreateTagOpen(false)}
        onSuccess={async (created) => {
          tagsCatalogue.addTag(created);
          await handleToggleTag(created.id, false);
          setCreateTagOpen(false);
        }}
      />
    </div>
  );
}
