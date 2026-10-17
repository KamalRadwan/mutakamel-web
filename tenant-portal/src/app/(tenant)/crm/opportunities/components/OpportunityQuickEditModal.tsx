"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePercent,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  DOSSIER_HEADER_CARD_COLORS,
  DateTime,
  Money,
  StatusBadge,
  TagChip,
  cn,
  dossierAvatarClass,
  dossierStageCellClass,
  useToast,
  type CardColor,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import { CustomFieldsCard } from "../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../shared/components/RecordNotesSection";
import { useCrmRecordCapabilities } from "../../shared/hooks/useCrmRecordCapabilities";
import { isExactMoneyDecimal, toMoneyWireNumber } from "../../shared/money";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../shared/tag-contract";
import { CreateTagModal } from "../../leads/components/create-lead/CreateTagModal";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsUserName,
  type LeadDetailsUser,
} from "../../leads/[id]/lead-details-edit-contract";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import {
  opportunityPath,
  opportunityStageHistoryPath,
  parseOpportunityDetailResponse,
  parseOpportunityStageHistory,
  type OpportunityDetail,
  type OpportunityStageHistoryEntry,
} from "../opportunity-contract";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import type {
  OpportunityActivityState,
  OpportunityStage,
  OpportunityStatus,
  StageFlag,
} from "../hooks/pipeline-types";
import type { OpportunityReadFields } from "../opportunity-read-model";

export interface OpportunityQuickEditItem extends OpportunityReadFields {
  id: string;
  branchId?: string;
  customerProfileId?: string;
  customerPartyId?: string | null;
  pipelineId?: string;
  stageId: string;
  stageFlag: StageFlag | null;
  status: OpportunityStatus;
  title: string;
  importance: number;
  amount: string | null;
  currencyCode: string | null;
  description?: string | null;
  expectedCloseDate?: string | null;
  probabilityPercent: number | null;
  ownerUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityQuickEditModalProps {
  item: OpportunityQuickEditItem | null;
  allItems?: readonly OpportunityQuickEditItem[];
  stages: readonly OpportunityStage[];
  branchId: string | null;
  canUpdate: (item: OpportunityQuickEditItem) => boolean;
  canDelete: (item: OpportunityQuickEditItem) => boolean;
  allowedOwnerIds?: string[] | null;
  onClose: () => void;
  onSelectOpportunity?: (item: OpportunityQuickEditItem) => void;
  onOpenActivities: (item: OpportunityQuickEditItem) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityQuickEditItem,
  ) => void;
  onMoveStage: (item: OpportunityQuickEditItem, stageId: string) => void;
  onDelete: (item: OpportunityQuickEditItem) => void;
  onSaved?: () => void;
}

type DossierTab = "activities" | "notes" | "history" | "files";

const CURRENCY_OPTIONS = ["EGP", "USD", "SAR", "AED", "EUR"] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function synthesizeOpportunityDetail(
  item: OpportunityQuickEditItem,
  branchId: string | null,
): OpportunityDetail {
  return {
    id: item.id,
    branchId: item.branchId ?? branchId ?? "",
    customerProfileId: item.customerProfileId ?? "",
    customerPartyId: item.customerPartyId ?? null,
    contactPartyId: item.primaryContact?.partyId ?? null,
    leadId: null,
    pipelineId: item.pipelineId ?? "",
    stageId: item.stageId,
    stageFlag: item.stageFlag,
    status: item.status,
    title: item.title,
    importance: item.importance,
    amount: item.amount,
    currencyCode: item.currencyCode,
    description: item.description ?? null,
    expectedCloseDate: item.expectedCloseDate ?? null,
    probabilityPercent: item.probabilityPercent,
    ownerUserId: item.ownerUserId ?? null,
    wonAt: null,
    lostAt: null,
    lostReason: null,
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
    cardColor: item.cardColor,
    customerProfileType: item.customerProfileType,
    customerDisplayName: item.customerDisplayName,
    customerCompanyName: item.customerCompanyName,
    customerPhone: item.customerPhone,
    customerEmail: item.customerEmail,
    customerCountry: item.customerCountry,
    customerCity: item.customerCity,
    primaryContact: item.primaryContact,
    leadSourceName: item.leadSourceName,
    leadSourceIconUrl: item.leadSourceIconUrl,
    ownerDisplayName: item.ownerDisplayName,
    ownerAvatarUrl: item.ownerAvatarUrl,
    openActivityCount: item.openActivityCount,
    nextOpenActivityAt: item.nextOpenActivityAt,
    activityState: item.activityState,
    tags: item.tags ?? [],
  };
}

function PhoneActionPills({
  phone,
  country,
}: {
  phone: string;
  country: string | null | undefined;
}) {
  const callDigits = normalizePhoneDigits(phone);
  const waDigits = normalizeWhatsAppDigits(phone, country ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {callDigits && (
        <a
          href={`tel:${callDigits}`}
          onClick={(e) => e.stopPropagation()}
          className="dossier-comm-btn dossier-comm-call"
          aria-label={`Call ${phone}`}
        >
          📞 Call
        </a>
      )}
      {waDigits && (
        <a
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="dossier-comm-btn dossier-comm-wa"
          aria-label={`WhatsApp ${phone}`}
        >
          💬 WhatsApp
        </a>
      )}
      {waDigits && (
        <a
          href={`https://t.me/+${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="dossier-comm-btn dossier-comm-tg"
          aria-label={`Telegram ${phone}`}
        >
          ✈️ Telegram
        </a>
      )}
    </div>
  );
}

/**
 * Centered 360° Quick-Edit & Inspector Modal for Opportunities implementing the
 * Dossier 360° Design System (100% parity with LeadQuickEditModal & CustomerQuickEditModal).
 */
export function OpportunityQuickEditModal({
  item,
  allItems = [],
  stages,
  branchId,
  canUpdate,
  canDelete,
  allowedOwnerIds = null,
  onClose,
  onSelectOpportunity,
  onOpenActivities,
  onCardChange,
  onMoveStage,
  onDelete,
  onSaved,
}: OpportunityQuickEditModalProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const { user: actor } = useTenantAuth();
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;

  const [detail, setDetail] = useState<OpportunityDetail | null>(() =>
    item ? synthesizeOpportunityDetail(item, branchId) : null,
  );
  const [localImportance, setLocalImportance] = useState<number>(
    item?.importance ?? 0,
  );
  const [localCardColor, setLocalCardColor] = useState<CardColor | null>(
    item?.cardColor ?? null,
  );
  const [localTags, setLocalTags] = useState<CrmTag[]>(item?.tags ?? []);
  const [stageHistory, setStageHistory] = useState<
    OpportunityStageHistoryEntry[]
  >([]);

  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [activeDossierTab, setActiveDossierTab] =
    useState<DossierTab>("activities");
  const [isSavingDeal, setIsSavingDeal] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Deal Edit Drafts
  const [titleDraft, setTitleDraft] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("EGP");
  const [probabilityDraft, setProbabilityDraft] = useState("");
  const [expectedCloseDraft, setExpectedCloseDraft] = useState("");
  const [ownerUserIdDraft, setOwnerUserIdDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  // Tag picker state
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);

  // Owner options
  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);

  const effectiveBranchId = detail?.branchId || item?.branchId || branchId || null;
  const attached = useCrmRecordCapabilities(effectiveBranchId);

  // Sync and fetch detail when `item` changes
  useEffect(() => {
    const controller = new AbortController();
    if (!item) {
      setDetail(null);
      return () => controller.abort();
    }

    const seeded = synthesizeOpportunityDetail(item, branchId);
    setDetail(seeded);
    setLocalImportance(item.importance);
    setLocalCardColor(item.cardColor);
    setLocalTags(item.tags ?? []);
    setIsEditingDeal(false);
    setSectionError(null);

    if (!isUUIDv7(item.id)) return () => controller.abort();

    void axiosClient
      .get<unknown>(opportunityPath(item.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        const parsed = parseOpportunityDetailResponse(res.data);
        setDetail(parsed);
        setLocalImportance(parsed.importance);
        setLocalCardColor(parsed.cardColor);
        if (parsed.tags.length > 0) setLocalTags(parsed.tags);
      })
      .catch(() => {
        // Keep synthesized detail
      });

    void axiosClient
      .get<unknown>(`${opportunityPath(item.id)}/tags`, {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 256 * 1024,
      })
      .then((res) => {
        if (!controller.signal.aborted && Array.isArray(res.data)) {
          setLocalTags(parseCrmTags(res.data));
        }
      })
      .catch(() => {});

    void axiosClient
      .get<unknown>(opportunityStageHistoryPath(item.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 256 * 1024,
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setStageHistory(parseOpportunityStageHistory(res.data));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [item, branchId]);

  // Load owner options when editing deal
  useEffect(() => {
    if (
      !isEditingDeal ||
      !canReadUsers ||
      !effectiveBranchId ||
      !isUUIDv7(effectiveBranchId)
    ) {
      return;
    }
    const controller = new AbortController();
    void readOwnerOptions(effectiveBranchId, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) {
          const filtered = list.filter(
            (u) => allowedOwnerIds === null || allowedOwnerIds.includes(u.id),
          );
          setOwnerOptions(filtered);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [allowedOwnerIds, canReadUsers, effectiveBranchId, isEditingDeal]);

  // Load tag catalogue when tag picker opens
  useEffect(() => {
    if (!isTagPickerOpen) return;
    const controller = new AbortController();
    void axiosClient
      .get<unknown>(CRM_TAGS_PATH, {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 256 * 1024,
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setAvailableTags(parseCrmTagCatalogue(res.data));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isTagPickerOpen]);

  const fallbackDetail = useMemo(
    () => (item ? detail ?? synthesizeOpportunityDetail(item, branchId) : null),
    [item, detail, branchId],
  );

  const editable = item ? canUpdate(item) : false;
  const deletable = item ? canDelete(item) : false;

  const currentIndex = item
    ? allItems.findIndex((entry) => entry.id === item.id)
    : -1;
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < allItems.length - 1
      ? allItems[currentIndex + 1]
      : null;

  const startDealEdit = useCallback(() => {
    if (!fallbackDetail || !editable) return;
    setSectionError(null);
    setTitleDraft(fallbackDetail.title);
    setAmountDraft(fallbackDetail.amount ?? "");
    setCurrencyDraft(fallbackDetail.currencyCode || "EGP");
    setProbabilityDraft(
      fallbackDetail.probabilityPercent === null
        ? ""
        : String(fallbackDetail.probabilityPercent),
    );
    setExpectedCloseDraft(
      fallbackDetail.expectedCloseDate
        ? fallbackDetail.expectedCloseDate.slice(0, 10)
        : "",
    );
    setOwnerUserIdDraft(fallbackDetail.ownerUserId ?? "");
    setDescriptionDraft(fallbackDetail.description ?? "");
    setIsEditingDeal(true);
  }, [editable, fallbackDetail]);

  async function saveDealEdit() {
    if (!item || !fallbackDetail) return;
    setSectionError(null);
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      setSectionError(
        isAr ? "يرجى إدخال عنوان الفرصة." : "Opportunity title is required.",
      );
      return;
    }
    const trimmedAmount = amountDraft.trim();
    if (trimmedAmount.length > 0 && !isExactMoneyDecimal(trimmedAmount)) {
      setSectionError(t.crmOpportunityDetail.create.amountInvalid);
      return;
    }
    const trimmedProb = probabilityDraft.trim();
    let parsedProb: number | null = null;
    if (trimmedProb.length > 0) {
      const n = Number(trimmedProb);
      if (!Number.isSafeInteger(n) || n < 0 || n > 100) {
        setSectionError(t.crmOpportunityDetail.create.outOfRange);
        return;
      }
      parsedProb = n;
    }

    setIsSavingDeal(true);
    try {
      const body: Record<string, unknown> = {
        title: trimmedTitle,
        description: descriptionDraft.trim(),
        probabilityPercent: parsedProb,
        expectedCloseDate:
          expectedCloseDraft.trim().length > 0
            ? expectedCloseDraft.trim()
            : null,
      };
      if (trimmedAmount.length > 0) {
        body.amount = toMoneyWireNumber(trimmedAmount);
        body.currencyCode = currencyDraft.trim().toUpperCase();
      }
      if (ownerUserIdDraft && isUUIDv7(ownerUserIdDraft)) {
        body.ownerUserId = ownerUserIdDraft;
      }

      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "patch",
        path: opportunityPath(item.id),
        body,
        parse: (payload) => payload,
      });

      if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
        const refreshed = await axiosClient.get<unknown>(
          opportunityPath(item.id),
          { cache: "no-store" },
        );
        setDetail(parseOpportunityDetailResponse(refreshed.data));
        setIsEditingDeal(false);
        onSaved?.();
        toast.success(
          t.crmOpportunityDetail.editOperation,
          trimmedTitle,
        );
      } else {
        setSectionError(
          outcome.error.message ?? t.crmOpportunities.cardUpdateFailed,
        );
      }
    } catch {
      setSectionError(t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSavingDeal(false);
    }
  }

  async function handleAttachTag(tag: CrmTag) {
    if (!item) return;
    if (localTags.some((tItem) => tItem.id === tag.id)) return;
    const nextTags = [...localTags, tag];
    setLocalTags(nextTags);
    try {
      const attempt = createWriteAttempt();
      await runIdempotentWrite({
        attempt,
        method: "post",
        path: `${opportunityPath(item.id)}/tags`,
        body: { tagIds: [tag.id] },
        parse: (payload) => payload,
      });
      onSaved?.();
    } catch {
      setLocalTags(localTags);
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!item) return;
    const prevTags = localTags;
    setLocalTags(prevTags.filter((tItem) => tItem.id !== tagId));
    try {
      const attempt = createWriteAttempt();
      await runIdempotentWrite({
        attempt,
        method: "delete",
        path: `${opportunityPath(item.id)}/tags/${encodeURIComponent(tagId)}`,
        parse: () => null,
      });
      onSaved?.();
    } catch {
      setLocalTags(prevTags);
    }
  }

  if (!item || !fallbackDetail) return null;

  const isCorporate = fallbackDetail.customerProfileType === "CORPORATE";
  const customerName =
    (isCorporate ? fallbackDetail.customerCompanyName : null) ??
    fallbackDetail.customerDisplayName ??
    t.crmOpportunities.notProvided;
  const primaryPhone =
    fallbackDetail.primaryContact?.phones[0] ??
    fallbackDetail.customerPhone ??
    null;
  const primaryEmail =
    fallbackDetail.primaryContact?.email ??
    fallbackDetail.customerEmail ??
    null;

  const currentStageIndex = stages.findIndex(
    (s) => s.id === fallbackDetail.stageId,
  );
  const topBarHex = localCardColor
    ? DOSSIER_HEADER_CARD_COLORS.find((c) => c.color === localCardColor)?.hex
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fallbackDetail.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 4px Color Filing Bar */}
        <div
          className="h-1.5 w-full shrink-0 bg-blue-600"
          style={topBarHex ? { backgroundColor: topBarHex } : undefined}
        />

        {/* Sticky Dossier 360° Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={dossierAvatarClass(
                  isCorporate,
                  fallbackDetail.status === "WON",
                )}
              >
                {getInitials(fallbackDetail.title)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    {fallbackDetail.title}
                  </h2>
                  <StatusBadge
                    value={fallbackDetail.status}
                    kind="OpportunityStatus"
                  />
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {isCorporate ? (
                      <Building2 className="size-3" aria-hidden="true" />
                    ) : (
                      <UserRound className="size-3" aria-hidden="true" />
                    )}
                    {isCorporate
                      ? t.crmLeads.card.company
                      : t.crmLeads.card.individual}
                  </span>
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {fallbackDetail.customerProfileId ? (
                    <Link
                      href={`/crm/customer-profiles/${fallbackDetail.customerProfileId}`}
                      className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {customerName} ↗
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {customerName}
                    </span>
                  )}
                  {fallbackDetail.customerCity ||
                  fallbackDetail.customerCountry ? (
                    <span>
                      ·{" "}
                      {[
                        fallbackDetail.customerCity,
                        fallbackDetail.customerCountry,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right Header Controls: Prev/Next + Full Page + Close */}
            <div className="flex items-center gap-1.5">
              {allItems.length > 1 && onSelectOpportunity && (
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <button
                    type="button"
                    disabled={!prevItem}
                    onClick={() => prevItem && onSelectOpportunity(prevItem)}
                    aria-label={t.common.previousPage}
                    className="flex size-7 items-center justify-center rounded-md text-slate-600 hover:bg-white disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </button>
                  <span className="px-2 text-[11px] font-bold tabular-nums text-slate-500">
                    {currentIndex + 1} / {allItems.length}
                  </span>
                  <button
                    type="button"
                    disabled={!nextItem}
                    onClick={() => nextItem && onSelectOpportunity(nextItem)}
                    aria-label={t.common.nextPage}
                    className="flex size-7 items-center justify-center rounded-md text-slate-600 hover:bg-white disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <ChevronRight
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  router.push(`/crm/opportunities/${fallbackDetail.id}`)
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span>{isAr ? "فتح الملف الكامل" : "Full Dossier"}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.cancel}
                className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Interactive Pipeline Stage Stepper Ribbon */}
          {stages.length > 0 && (
            <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
              {stages.map((st, idx) => {
                const isCurrent = st.id === fallbackDetail.stageId;
                const isCompleted =
                  currentStageIndex >= 0 && idx < currentStageIndex;
                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={!editable || isCurrent}
                    onClick={() => onMoveStage(item, st.id)}
                    className={cn(
                      dossierStageCellClass({
                        flag: st.flag,
                        isCurrent,
                        isPast: isCompleted,
                      }),
                      "min-w-28 flex-1 text-xs",
                    )}
                  >
                    <span className="truncate">{localizedName(st, lang)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Scrollable 2-Column Dossier Content */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-12">
          {/* Left Main Column (8 cols) */}
          <div className="space-y-4 lg:col-span-8">
            {/* Card 1: Deal Commercials & Scope */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Banknote
                    className="size-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    {isAr
                      ? "القيمة التجارية ونطاق الصفقة"
                      : "Deal Commercials & Scope"}
                  </h3>
                </div>

                {editable && !isEditingDeal && (
                  <button
                    type="button"
                    onClick={startDealEdit}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    <span>{t.crmLeadDetail.edit}</span>
                  </button>
                )}
              </div>

              {sectionError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                >
                  {sectionError}
                </div>
              )}

              {isEditingDeal ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.crmOpportunities.title} *
                      </label>
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.crmOpportunityDetail.amount}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          value={amountDraft}
                          onChange={(e) => setAmountDraft(e.target.value)}
                          placeholder="0.00"
                          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <select
                          value={currencyDraft}
                          onChange={(e) => setCurrencyDraft(e.target.value)}
                          className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {CURRENCY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.crmOpportunityDetail.probability} (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        dir="ltr"
                        value={probabilityDraft}
                        onChange={(e) => setProbabilityDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.crmOpportunities.expectedClose}
                      </label>
                      <input
                        type="date"
                        dir="ltr"
                        value={expectedCloseDraft}
                        onChange={(e) => setExpectedCloseDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    {ownerOptions.length > 0 && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t.crmOpportunities.owner}
                        </label>
                        <select
                          value={ownerUserIdDraft}
                          onChange={(e) => setOwnerUserIdDraft(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">
                            {isAr ? "غير معين" : "Unassigned"}
                          </option>
                          {ownerOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {leadDetailsUserName(u)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.crmOpportunities.advancedSearch.fields.description}
                      </label>
                      <textarea
                        rows={3}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isSavingDeal}
                      onClick={() => setIsEditingDeal(false)}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingDeal}
                      onClick={() => void saveDealEdit()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isSavingDeal && (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      <span>{t.common.save}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                        {t.crmOpportunityDetail.amount}
                      </span>
                      <div className="mt-1 text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                        {fallbackDetail.amount ? (
                          <Money
                            value={fallbackDetail.amount}
                            currency={fallbackDetail.currencyCode ?? undefined}
                            language={lang}
                          />
                        ) : (
                          t.crmOpportunities.notProvided
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <span className="block text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">
                        {t.crmOpportunityDetail.probability}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 text-base font-extrabold text-blue-900 dark:text-blue-200">
                        <CirclePercent className="size-4" aria-hidden="true" />
                        <span>
                          {fallbackDetail.probabilityPercent !== null
                            ? formatTemplate(
                                t.crmOpportunityDetail.probabilityValue,
                                {
                                  percent: formatNumber(
                                    fallbackDetail.probabilityPercent,
                                    lang,
                                  ),
                                },
                              )
                            : t.crmOpportunities.notProvided}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        {t.crmOpportunities.expectedClose}
                      </span>
                      <div className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <Calendar
                          className="size-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        {fallbackDetail.expectedCloseDate ? (
                          <DateTime
                            value={`${fallbackDetail.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                            precision="date"
                            language={lang}
                            timeZone="UTC"
                          />
                        ) : (
                          <span>{t.crmOpportunities.notProvided}</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        {t.crmOpportunities.owner}
                      </span>
                      <div className="mt-1 truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {fallbackDetail.ownerDisplayName ||
                          (isAr ? "غير معين" : "Unassigned")}
                      </div>
                    </div>
                  </div>

                  {fallbackDetail.description && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                        {t.crmOpportunities.advancedSearch.fields.description}
                      </span>
                      <p className="whitespace-pre-line">
                        {fallbackDetail.description}
                      </p>
                    </div>
                  )}

                  {fallbackDetail.lostReason && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                      <span className="mb-0.5 block text-[10px] font-bold uppercase">
                        {t.crmOpportunityDetail.lostReason}
                      </span>
                      <p>{fallbackDetail.lostReason}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Card 2: Customer & Primary Contact Reach Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2
                    className="size-4 text-blue-600"
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    {isAr
                      ? "العميل ومسؤول التواصل"
                      : "Customer & Primary Contact"}
                  </h3>
                </div>

                {fallbackDetail.customerProfileId && (
                  <Link
                    href={`/crm/customer-profiles/${fallbackDetail.customerProfileId}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span>{t.crmOpportunities.viewCustomer}</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    {t.crmOpportunities.customer}
                  </span>
                  <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {customerName}
                  </div>
                  {(fallbackDetail.customerCity ||
                    fallbackDetail.customerCountry) && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      <span>
                        {[
                          fallbackDetail.customerCity,
                          fallbackDetail.customerCountry,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    {isAr ? "جهة الاتصال الأساسية" : "Primary Contact"}
                  </span>
                  <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {fallbackDetail.primaryContact?.displayName || customerName}
                  </div>
                  {fallbackDetail.primaryContact?.jobTitle && (
                    <div className="text-xs text-slate-500">
                      {fallbackDetail.primaryContact.jobTitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="space-y-1 text-xs">
                  {primaryPhone && (
                    <div
                      className="font-mono font-bold text-slate-900 dark:text-slate-100"
                      dir="ltr"
                    >
                      {primaryPhone}
                    </div>
                  )}
                  {primaryEmail && (
                    <a
                      href={`mailto:${primaryEmail}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <Mail className="size-3.5" aria-hidden="true" />
                      <span>{primaryEmail}</span>
                    </a>
                  )}
                </div>

                {primaryPhone && (
                  <PhoneActionPills
                    phone={primaryPhone}
                    country={fallbackDetail.customerCountry}
                  />
                )}
              </div>
            </section>

            {/* Card 3: Tabbed Workspace (Activities | Notes | Stage History | Files) */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                {(
                  [
                    {
                      id: "activities",
                      label: isAr ? "الأنشطة والمتابعة" : "Activities",
                    },
                    { id: "notes", label: isAr ? "الملاحظات" : "Notes" },
                    {
                      id: "history",
                      label: t.crmOpportunityDetail.historyTitle,
                    },
                    { id: "files", label: isAr ? "المرفقات" : "Files" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDossierTab(tab.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                      activeDossierTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeDossierTab === "activities" && (
                <RecordActivitiesPanel
                  target={{
                    app: "CRM",
                    type: "OPPORTUNITY",
                    id: fallbackDetail.id,
                    label: fallbackDetail.title,
                  }}
                  readOnly={!editable}
                />
              )}

              {activeDossierTab === "notes" && (
                <RecordNotesSection
                  branchId={effectiveBranchId ?? fallbackDetail.branchId}
                  sourceType="OPPORTUNITY"
                  sourceId={fallbackDetail.id}
                  sourceOwnerUserId={fallbackDetail.ownerUserId}
                  createCapability={attached.capabilities.notesCreate}
                  deleteCapability={attached.capabilities.notesDelete}
                  readOnly={!editable}
                />
              )}

              {activeDossierTab === "history" && (
                <div className="space-y-4">
                  {stageHistory.length > 0 && (
                    <div className="space-y-2">
                      {stageHistory.map((entry) => {
                        const fromName = entry.fromStageSnapshot
                          ? localizedValue(
                              entry.fromStageSnapshot.stageNameAr,
                              entry.fromStageSnapshot.stageNameEn,
                              lang,
                            )
                          : "—";
                        const toName = entry.toStageSnapshot
                          ? localizedValue(
                              entry.toStageSnapshot.stageNameAr,
                              entry.toStageSnapshot.stageNameEn,
                              lang,
                            )
                          : "—";
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {formatTemplate(
                                  t.crmOpportunityDetail.stageMoved,
                                  { from: fromName, to: toName },
                                )}
                              </span>
                              {entry.reason && (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {entry.reason}
                                </p>
                              )}
                            </div>
                            {entry.changedAt && (
                              <DateTime
                                value={entry.changedAt}
                                precision="datetime"
                                language={lang}
                                className="text-[11px] text-slate-400"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <EntityHistoryCard
                    density="compact"
                    entityType="Opportunity"
                    entityId={fallbackDetail.id}
                    refreshToken={fallbackDetail}
                  />
                </div>
              )}

              {activeDossierTab === "files" && (
                <RecordAttachmentsSection
                  branchId={effectiveBranchId ?? fallbackDetail.branchId}
                  sourceType="OPPORTUNITY"
                  sourceId={fallbackDetail.id}
                  sourceOwnerUserId={fallbackDetail.ownerUserId}
                  createCapability={attached.capabilities.attachmentsCreate}
                  deleteCapability={attached.capabilities.attachmentsDelete}
                  readOnly={!editable}
                  uploadVariant="button"
                  density="compact"
                />
              )}
            </section>
          </div>

          {/* Right Sticky Executive Sidebar (4 cols) */}
          <aside className="space-y-4 lg:col-span-4">
            {/* Importance & Card Color Filing Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {t.crmOpportunities.importance}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((st) => {
                    const active = st <= localImportance;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={!editable}
                        onClick={() => {
                          const next = localImportance === st ? 0 : st;
                          setLocalImportance(next);
                          onCardChange(item.id, { importance: next }, item);
                        }}
                        className="p-0.5 disabled:cursor-default"
                      >
                        <Star
                          className={cn(
                            "size-4",
                            active
                              ? "fill-amber-400 text-amber-500"
                              : "text-slate-300 dark:text-slate-600",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="mb-2 block text-[11px] font-bold text-slate-500">
                  {t.crmLeads.card.cardColor}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DOSSIER_HEADER_CARD_COLORS.map(({ color, hex }) => {
                    const selected = localCardColor === color;
                    return (
                      <button
                        key={color ?? "NONE"}
                        type="button"
                        disabled={!editable}
                        onClick={() => {
                          const next = selected ? null : color;
                          setLocalCardColor(next);
                          onCardChange(item.id, { cardColor: next }, item);
                        }}
                        style={
                          color !== null ? { backgroundColor: hex } : undefined
                        }
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border border-slate-200 transition-transform hover:scale-110 dark:border-slate-700",
                          selected &&
                            "ring-2 ring-slate-900 ring-offset-2 dark:ring-white",
                        )}
                      >
                        {selected && (
                          <Check className="size-3 text-white" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tags Manager Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {t.crmLeads.create.tags}
                </span>
                {editable && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsTagPickerOpen((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      <span>{t.common.create}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateTagOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    >
                      <span>+ {t.crmTags.add}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {localTags.length === 0 ? (
                  <span className="text-xs text-slate-400">
                    {t.crmOpportunities.notProvided}
                  </span>
                ) : (
                  localTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1"
                    >
                      <TagChip
                        label={tag.name}
                        backgroundColor={tag.backgroundColor}
                        textColor={tag.textColor}
                      />
                      {editable && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveTag(tag.id)}
                          aria-label={`Remove ${tag.name}`}
                          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {isTagPickerOpen && (
                <div className="mt-2.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                  {availableTags.map((tag) => {
                    const attachedTag = localTags.some((tItem) => tItem.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          attachedTag
                            ? void handleRemoveTag(tag.id)
                            : void handleAttachTag(tag)
                        }
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-white dark:hover:bg-slate-700"
                      >
                        <TagChip
                          label={tag.name}
                          backgroundColor={tag.backgroundColor}
                          textColor={tag.textColor}
                        />
                        {attachedTag && (
                          <Check
                            className="size-3.5 text-blue-600"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Fields Card */}
            {effectiveBranchId && (
              <CustomFieldsCard
                density="compact"
                branchId={effectiveBranchId}
                ownerType="OPPORTUNITY"
                ownerId={fallbackDetail.id}
              />
            )}

            {/* Acquisition Source & Quick Actions Card */}
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              {fallbackDetail.leadSourceName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">
                    {t.crmAcquisitionSources.source}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                    <AcquisitionSourceIcon
                      source={{ iconUrl: fallbackDetail.leadSourceIconUrl }}
                    />
                    <span>{fallbackDetail.leadSourceName}</span>
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => onOpenActivities(item)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                <Activity className="size-3.5" aria-hidden="true" />
                <span>{t.activities.title}</span>
              </button>

              {deletable && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(item);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>{t.crmOpportunities.deleteTitle}</span>
                </button>
              )}
            </div>
          </aside>
        </div>

        <CreateTagModal
          open={createTagOpen}
          existingTags={availableTags}
          onClose={() => setCreateTagOpen(false)}
          onSuccess={(newTag) => {
            setAvailableTags((prev) =>
              prev.some((existing) => existing.id === newTag.id)
                ? prev
                : [...prev, newTag],
            );
            void handleAttachTag(newTag);
            setCreateTagOpen(false);
          }}
        />
      </div>
    </div>
  );
}
