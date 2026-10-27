"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MessageCircle,
  Phone,
  Send,
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
  Button,
  DOSSIER_HEADER_CARD_COLORS,
  DOSSIER_KPI_PILL_CLASSES,
  DateTime,
  Money,
  PermissionGate,
  StatusBadge,
  TagChip,
  cn,
  dossierAvatarClass,
  dossierStageCellClass,
  useToast,
  type CardColor,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useTenantAuth } from "@/context/AuthContext";
import { useOpportunityCurrencyOptions } from "../hooks/useCreateOpportunity";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { normalizeApiError } from "@/lib/api/errors";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import { CustomFieldsCard } from "../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../shared/components/RecordNotesSection";
import { useCrmRecordCapabilities } from "../../shared/hooks/useCrmRecordCapabilities";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { isExactMoneyDecimal, toMoneyWireNumber } from "../../shared/money";
import { buildPartyDocumentHref } from "../../shared/party-document-counts-contract";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../shared/tag-contract";
import { CreateTagModal } from "../../leads/components/create-lead/CreateTagModal";
import { readAssignableOpportunityOwners } from "../hooks/usePipelineWorkspace";
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
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../opportunity-contract";
import { useOpportunityStageHistory } from "../hooks/useOpportunityStageHistory";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import { useOpportunityDocumentCounts } from "../hooks/useOpportunityDocumentCounts";
import type {
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
  ) => Promise<boolean>;
  onMoveStage: (item: OpportunityQuickEditItem, stageId: string) => void;
  onDelete: (item: OpportunityQuickEditItem) => void;
  onSaved?: () => void;
  onForbidden?: () => void;
}

type DossierTab = "activities" | "notes" | "history" | "files";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function OpportunityPhoneActions({
  phone,
  country,
}: {
  phone: string;
  country: string | null | undefined;
}) {
  const { t } = useI18n();
  const callDigits = normalizePhoneDigits(phone);
  const waDigits = normalizeWhatsAppDigits(phone, country ?? "");
  const links = [
    { href: callDigits ? `tel:${callDigits}` : null, label: formatTemplate(t.crmLeadDetail.callNumber, { value: phone }), icon: Phone, external: false },
    { href: waDigits ? `https://wa.me/${waDigits}` : null, label: formatTemplate(t.crmLeadDetail.whatsappNumber, { value: phone }), icon: MessageCircle, external: true },
    { href: waDigits ? `https://t.me/+${waDigits}` : null, label: formatTemplate(t.crmLeadDetail.telegramNumber, { value: phone }), icon: Send, external: true },
  ];
  return (
    <div className="flex shrink-0 items-center gap-1">
      {links.map(({ href, label, icon: Icon, external }) => href && (
        <Button key={href} variant="ghost" size="xs" asChild>
          <a href={href} aria-label={label} title={label}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            onClick={(event) => event.stopPropagation()}>
            <Icon className="size-4" aria-hidden="true" />
          </a>
        </Button>
      ))}
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
  onForbidden,
}: OpportunityQuickEditModalProps) {
  const { t, lang } = useI18n();
  const canReadHistory = useAuditAccess();
  const router = useRouter();
  const toast = useToast();
  const errorText = useCrmErrorText();
  const { user: actor } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const canOpenActivities = canMutate && canCreateActivities(actor);
  const canManageTags = actor?.permissions.includes("crm.tags.manage") ?? false;
  const activeItemId = useRef(item?.id);
  useEffect(() => {
    activeItemId.current = item?.id;
    return () => { activeItemId.current = undefined; };
  }, [item?.id]);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const [detailReload, setDetailReload] = useState(0);
  const [localImportance, setLocalImportance] = useState<number>(
    item?.importance ?? 0,
  );
  const [localCardColor, setLocalCardColor] = useState<CardColor | null>(
    item?.cardColor ?? null,
  );
  const [localTags, setLocalTags] = useState<CrmTag[]>(item?.tags ?? []);
  const history = useOpportunityStageHistory(item?.id, detailReload, onForbidden);

  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const currencyOptions = useOpportunityCurrencyOptions(isEditingDeal);
  const [activeDossierTab, setActiveDossierTab] =
    useState<DossierTab>("activities");
  const [isSavingDeal, setIsSavingDeal] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Deal Edit Drafts
  const [titleDraft, setTitleDraft] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("");
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
  const ownerScope = useOrganizationScopeHeaders("BRANCH_REQUIRED", effectiveBranchId);
  const effectiveCustomerPartyId = detail?.customerPartyId ?? item?.customerPartyId ?? null;
  const countRecords = useMemo(
    () => (effectiveCustomerPartyId ? [{ customerPartyId: effectiveCustomerPartyId }] : []),
    [effectiveCustomerPartyId],
  );
  const documentCounts = useOpportunityDocumentCounts(
    countRecords,
    effectiveBranchId,
    Boolean(effectiveCustomerPartyId),
  );
  const partyCounts = effectiveCustomerPartyId
    ? documentCounts.countsByParty.get(effectiveCustomerPartyId)
    : undefined;
  const attached = useCrmRecordCapabilities(effectiveBranchId);

  // Sync and fetch detail when `item` changes
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!item) {
        setDetail(null);
        return;
      }
      setDetail(null);
      setDetailLoadFailed(!isUUIDv7(item.id));
      setLocalImportance(item.importance);
      setLocalCardColor(item.cardColor);
      setLocalTags(item.tags ?? []);
      setIsEditingDeal(false);
      setSectionError(null);
    });
    if (!item || !isUUIDv7(item.id)) {
      return () => controller.abort();
    }

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
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setDetailLoadFailed(true);
        if (normalizeApiError(caught).status === 403) onForbidden?.();
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

    return () => controller.abort();
  }, [item, branchId, detailReload, onForbidden]);

  const canEditOwner = canMutate && Boolean(item && canUpdate(item));

  // CRM applies assignment scope without granting Core directory access.
  useEffect(() => {
    if (!isEditingDeal || !canEditOwner || !effectiveBranchId || !ownerScope.ready) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setOwnerOptions([]);
    });
    void readAssignableOpportunityOwners(effectiveBranchId, controller.signal, ownerScope.headers)
      .then((list) => {
        if (!controller.signal.aborted) {
          setOwnerOptions(list.filter((owner) => allowedOwnerIds === null || allowedOwnerIds.includes(owner.id)));
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setOwnerOptions([]);
        if (normalizeApiError(caught).status === 403) onForbidden?.();
      });
    return () => controller.abort();
  }, [allowedOwnerIds, canEditOwner, effectiveBranchId, isEditingDeal, onForbidden, ownerScope]);

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

  // Never use a previous selection or a partial list row as an edit baseline.
  const fallbackDetail = detail?.id === item?.id ? detail : null;

  const editable = canMutate && (item ? canUpdate(item) : false);
  const deletable = canMutate && (item ? canDelete(item) : false);

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
    setCurrencyDraft(fallbackDetail.currencyCode ?? "");
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
    if (!item || !fallbackDetail || !editable || !isEditingDeal || isSavingDeal) return;
    setSectionError(null);
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      setSectionError(
        t.crmOpportunities.titleRequired,
      );
      return;
    }
    const trimmedAmount = amountDraft.trim();
    const amountChanged = trimmedAmount !== (fallbackDetail.amount ?? "").trim();
    const currencyCode = currencyDraft.trim().toUpperCase();
    const currencyChanged = currencyCode !== (fallbackDetail.currencyCode ?? "").trim().toUpperCase();
    if ((amountChanged || currencyChanged) && trimmedAmount && !currencyCode) {
      setSectionError(t.crmShared.refusals.OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED);
      return;
    }
    if (trimmedAmount.length > 0 && !isExactMoneyDecimal(trimmedAmount, currencyDraft)) {
      setSectionError(t.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID);
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
      const body: Record<string, unknown> = {};
      if (trimmedTitle !== fallbackDetail.title.trim()) body.title = trimmedTitle;
      const description = descriptionDraft.trim();
      if (description !== (fallbackDetail.description ?? "").trim()) {
        body.description = description;
      }
      if (trimmedProb !== (fallbackDetail.probabilityPercent === null
        ? ""
        : String(fallbackDetail.probabilityPercent))) {
        body.probabilityPercent = parsedProb;
      }
      const expectedCloseDate = expectedCloseDraft.trim();
      if (expectedCloseDate !== (fallbackDetail.expectedCloseDate?.slice(0, 10) ?? "")) {
        body.expectedCloseDate = expectedCloseDate || null;
      }
      if (amountChanged) {
        body.amount = trimmedAmount ? toMoneyWireNumber(trimmedAmount, currencyDraft) : null;
      }
      if (currencyChanged) {
        body.currencyCode = currencyCode || null;
        if (!currencyCode) body.amount = null;
      }
      if (ownerUserIdDraft !== (fallbackDetail.ownerUserId ?? "") && ownerScope.ready && ownerOptions.some(({ id }) => id === ownerUserIdDraft)) {
        body.ownerUserId = ownerUserIdDraft;
      }
      if (Object.keys(body).length === 0) {
        setIsEditingDeal(false);
        return;
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
        if (outcome.error.status === 403) onForbidden?.();
        setSectionError(
          errorText(outcome.error) ?? t.crmOpportunities.cardUpdateFailed,
        );
      }
    } catch (caught) {
      if (normalizeApiError(caught).status === 403) onForbidden?.();
      setSectionError(errorText(normalizeApiError(caught)) ?? t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSavingDeal(false);
    }
  }

  async function handleAttachTag(tag: CrmTag) {
    if (!item || !editable || isSavingTags) return;
    if (localTags.some((tItem) => tItem.id === tag.id)) return;
    const nextTags = [...localTags, tag];
    setSectionError(null);
    setIsSavingTags(true);
    setLocalTags(nextTags);
    try {
      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "post",
        path: `${opportunityPath(item.id)}/tags`,
        body: { tagIds: [tag.id] },
        parse: (payload) => payload,
      });
      if (activeItemId.current !== item.id) return;
      if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
        onSaved?.();
      } else {
        setLocalTags(localTags);
        if (outcome.error.status === 403) onForbidden?.();
        setSectionError(errorText(outcome.error) ?? t.crmOpportunities.cardUpdateFailed);
      }
    } catch (caught) {
      if (activeItemId.current !== item.id) return;
      setLocalTags(localTags);
      setSectionError(errorText(normalizeApiError(caught)) ?? t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSavingTags(false);
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!item || !editable || isSavingTags) return;
    const prevTags = localTags;
    setSectionError(null);
    setIsSavingTags(true);
    setLocalTags(prevTags.filter((tItem) => tItem.id !== tagId));
    try {
      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "delete",
        path: `${opportunityPath(item.id)}/tags/${encodeURIComponent(tagId)}`,
        parse: () => null,
      });
      if (activeItemId.current !== item.id) return;
      if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
        onSaved?.();
      } else {
        setLocalTags(prevTags);
        if (outcome.error.status === 403) onForbidden?.();
        setSectionError(errorText(outcome.error) ?? t.crmOpportunities.cardUpdateFailed);
      }
    } catch (caught) {
      if (activeItemId.current !== item.id) return;
      setLocalTags(prevTags);
      setSectionError(errorText(normalizeApiError(caught)) ?? t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSavingTags(false);
    }
  }

  async function handleCardChange(patch: OpportunityCardPatch) {
    if (!item || !editable || isSavingCard) return;
    const previous = { importance: localImportance, cardColor: localCardColor };
    setSectionError(null);
    setIsSavingCard(true);
    if (patch.importance !== undefined) setLocalImportance(patch.importance);
    if (patch.cardColor !== undefined) setLocalCardColor(patch.cardColor);
    try {
      const updated = await onCardChange(item.id, patch, {
        ...item,
        ...previous,
      });
      if (activeItemId.current !== item.id) return;
      if (!updated) {
        setLocalImportance(previous.importance);
        setLocalCardColor(previous.cardColor);
        setSectionError(t.crmOpportunities.cardUpdateFailed);
      }
    } catch (caught) {
      if (activeItemId.current !== item.id) return;
      setLocalImportance(previous.importance);
      setLocalCardColor(previous.cardColor);
      setSectionError(errorText(normalizeApiError(caught)) ?? t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSavingCard(false);
    }
  }

  if (!item) return null;
  if (!fallbackDetail) {
    return (
      <div role="dialog" aria-modal="true" aria-label={item.title}
        className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-foreground/60 p-4">
        <div className="space-y-4 rounded-lg border border-border bg-background p-5 text-foreground">
          <p role={detailLoadFailed ? "alert" : "status"} aria-busy={!detailLoadFailed}>
            {detailLoadFailed ? t.crmOpportunities.loadFailed : t.common.loading}
          </p>
          <div className="flex gap-2">
            {detailLoadFailed && (
              <Button onClick={() => { setDetailLoadFailed(false); setDetailReload((value) => value + 1); }}>
                {t.common.retry}
              </Button>
            )}
            <Button onClick={onClose}>{t.common.close}</Button>
          </div>
        </div>
      </div>
    );
  }

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
      className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-foreground/60 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 4px Color Filing Bar */}
        <div
          className="h-1.5 w-full shrink-0 bg-primary"
          style={topBarHex ? { backgroundColor: topBarHex } : undefined}
        />

        {/* Sticky Dossier 360° Header */}
        <header className="shrink-0 border-b border-border bg-card px-5 py-3.5">
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
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {fallbackDetail.title}
                  </h2>
                  <StatusBadge
                    value={fallbackDetail.status}
                    kind="OpportunityStatus"
                  />
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-2xs font-semibold text-foreground">
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

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {fallbackDetail.customerProfileId ? (
                    <Link
                      href={`/crm/customer-profiles/${fallbackDetail.customerProfileId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {customerName} ↗
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">
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

            {/* Right Header Controls: Trade Counters + Prev/Next + Full Page + Close */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={buildPartyDocumentHref("quotations", fallbackDetail.customerPartyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.quotations}
              >
                📄 Quotations <b>{partyCounts?.quotations ?? 0}</b>
              </Link>
              <Link
                href={buildPartyDocumentHref("salesOrders", fallbackDetail.customerPartyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.salesOrders}
              >
                📦 Orders <b>{partyCounts?.salesOrders ?? 0}</b>
              </Link>
              <Link
                href={buildPartyDocumentHref("invoices", fallbackDetail.customerPartyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.invoices}
              >
                🧾 Invoices <b>{partyCounts?.invoices ?? 0}</b>
              </Link>

              {allItems.length > 1 && onSelectOpportunity && (
                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!prevItem}
                    onClick={() => prevItem && onSelectOpportunity(prevItem)}
                    aria-label={t.common.previousPage}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ChevronLeft
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Button>
                  <span className="px-2 text-2xs font-semibold tabular-nums text-muted-foreground">
                    {currentIndex + 1} / {allItems.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!nextItem}
                    onClick={() => nextItem && onSelectOpportunity(nextItem)}
                    aria-label={t.common.nextPage}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ChevronRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  router.push(`/crm/opportunities/${fallbackDetail.id}`)
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted/50"
              >
                <span>{t.crmOpportunities.fullDossier}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onClose}
                aria-label={t.common.cancel}
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Interactive Pipeline Stage Stepper Ribbon */}
          {stages.length > 0 && (
            <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
              {stages.map((st, idx) => {
                const isCurrent = st.id === fallbackDetail.stageId;
                if (!editable) return isCurrent ? <span key={st.id}>{localizedName(st, lang)}</span> : null;
                const isCompleted =
                  currentStageIndex >= 0 && idx < currentStageIndex;
                return (
                  <Button
                    key={st.id}
                    type="button"
                    variant="ghost"
                    size="xs"
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
                  </Button>
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
            <section className="rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Banknote
                    className="size-4 text-success"
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t.crmOpportunities.dealCommercials}
                  </h3>
                </div>

                {editable && !isEditingDeal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={startDealEdit}
                    className="inline-flex h-auto items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    <span>{t.crmLeadDetail.edit}</span>
                  </Button>
                )}
              </div>

              {sectionError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-destructive/30 bg-destructive-subtle p-2.5 text-xs font-medium text-destructive-subtle-foreground"
                >
                  {sectionError}
                </div>
              )}

              {isEditingDeal && editable ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        {t.crmOpportunities.title} *
                      </label>
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">
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
                          className="h-9 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-xs font-semibold tabular-nums text-foreground"
                        />
                        <select
                          aria-label={t.crmLeadConvert.currencyCode}
                          value={currencyDraft}
                          onChange={(e) => setCurrencyDraft(e.target.value)}
                          className="h-9 w-24 rounded-lg border border-input bg-card px-2 text-xs font-semibold text-foreground"
                        >
                          {!fallbackDetail.currencyCode && (
                            <option value="">{t.crmOpportunities.notProvided}</option>
                          )}
                          {[...new Set([fallbackDetail.currencyCode, ...currencyOptions])]
                            .filter((c): c is string => Boolean(c))
                            .map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        {t.crmOpportunityDetail.probability} (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        dir="ltr"
                        value={probabilityDraft}
                        onChange={(e) => setProbabilityDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        {t.crmOpportunities.expectedClose}
                      </label>
                      <input
                        type="date"
                        dir="ltr"
                        value={expectedCloseDraft}
                        onChange={(e) => setExpectedCloseDraft(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
                      />
                    </div>

                    {ownerScope.ready && ownerOptions.length > 0 && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">
                          {t.crmOpportunities.owner}
                        </label>
                        <select
                          value={ownerUserIdDraft}
                          onChange={(e) => setOwnerUserIdDraft(e.target.value)}
                          className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground"
                        >
                          {ownerOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {leadDetailsUserName(u)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        {t.crmOpportunities.advancedSearch.fields.description}
                      </label>
                      <textarea
                        rows={3}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        className="w-full rounded-lg border border-input bg-card p-2.5 text-xs text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border pt-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isSavingDeal}
                      onClick={() => setIsEditingDeal(false)}
                      className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    >
                      {t.common.cancel}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="xs"
                      disabled={isSavingDeal}
                      onClick={() => void saveDealEdit()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSavingDeal && (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      <span>{t.common.save}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-success/30 bg-success-subtle/50 p-3">
                      <span className="block text-2xs font-semibold uppercase text-success">
                        {t.crmOpportunityDetail.amount}
                      </span>
                      <div className="mt-1 text-base font-semibold text-success-subtle-foreground">
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

                    <div className="rounded-lg border border-primary/30 bg-primary-subtle/50 p-3">
                      <span className="block text-2xs font-semibold uppercase text-primary">
                        {t.crmOpportunityDetail.probability}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 text-base font-semibold text-primary-subtle-foreground">
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

                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                        {t.crmOpportunities.expectedClose}
                      </span>
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                        <Calendar
                          className="size-3.5 text-muted-foreground"
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

                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                        {t.crmOpportunities.owner}
                      </span>
                      <div className="mt-1 truncate text-xs font-semibold text-foreground">
                        {fallbackDetail.ownerDisplayName ||
                          t.crmOpportunities.unassigned}
                      </div>
                    </div>
                  </div>

                  {fallbackDetail.description && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
                      <span className="mb-1 block text-2xs font-semibold uppercase text-muted-foreground">
                        {t.crmOpportunities.advancedSearch.fields.description}
                      </span>
                      <p className="whitespace-pre-line">
                        {fallbackDetail.description}
                      </p>
                    </div>
                  )}

                  {fallbackDetail.lostReason && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground">
                      <span className="mb-0.5 block text-2xs font-semibold uppercase">
                        {t.crmOpportunityDetail.lostReason}
                      </span>
                      <p>{fallbackDetail.lostReason}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Card 2: Customer & Primary Contact Reach Card */}
            <section className="rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Building2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t.crmOpportunities.customerAndContact}
                  </h3>
                </div>

                {fallbackDetail.customerProfileId && (
                  <Link
                    href={`/crm/customer-profiles/${fallbackDetail.customerProfileId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>{t.crmOpportunities.viewCustomer}</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                    {t.crmOpportunities.customer}
                  </span>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">
                    {customerName}
                  </div>
                  {(fallbackDetail.customerCity ||
                    fallbackDetail.customerCountry) && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
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
                  <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                    {t.crmOpportunities.primaryContact}
                  </span>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">
                    {fallbackDetail.primaryContact?.displayName || customerName}
                  </div>
                  {fallbackDetail.primaryContact?.jobTitle && (
                    <div className="text-xs text-muted-foreground">
                      {fallbackDetail.primaryContact.jobTitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="space-y-1 text-xs">
                  {primaryPhone && (
                    <div
                      className="font-mono font-semibold tabular-nums text-foreground"
                      dir="ltr"
                    >
                      {primaryPhone}
                    </div>
                  )}
                  {primaryEmail && (
                    <a
                      href={`mailto:${primaryEmail}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="size-3.5" aria-hidden="true" />
                      <span>{primaryEmail}</span>
                    </a>
                  )}
                </div>

                {primaryPhone && (
                  <OpportunityPhoneActions
                    phone={primaryPhone}
                    country={fallbackDetail.customerCountry}
                  />
                )}
              </div>
            </section>

            {/* Card 3: Tabbed Workspace (Activities | Notes | Stage History | Files) */}
            <section className="rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div
                role="tablist"
                className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-border pb-2.5"
              >
                {(
                  [
                    {
                      id: "activities",
                      label: t.crmOpportunities.activitiesTab,
                    },
                    { id: "notes", label: t.crmOpportunities.notesTab },
                    {
                      id: "history",
                      label: t.crmOpportunityDetail.historyTitle,
                    },
                    { id: "files", label: t.crmOpportunities.filesTab },
                  ] as const
                ).filter((tab) => tab.id !== "history" || canReadHistory).map((tab) => (
                  <Button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === tab.id}
                    variant="ghost"
                    size="xs"
                    onClick={() => setActiveDossierTab(tab.id)}
                    className={cn(
                      "h-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      activeDossierTab === tab.id
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Button>
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
                  readOnly={!editable}
                />
              )}

              {activeDossierTab === "history" && (
                <div className="space-y-4" aria-busy={history.loading}>
                  {history.denied && <PermissionGate require="crm.opportunities.read" scoped denied>{null}</PermissionGate>}
                  {history.items.length > 0 && (
                    <div className="space-y-2">
                      {history.items.map((entry) => {
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
                            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-foreground">
                                {formatTemplate(
                                  t.crmOpportunityDetail.stageMoved,
                                  { from: fromName, to: toName },
                                )}
                              </span>
                              {entry.reason && (
                                <p className="mt-0.5 text-2xs text-muted-foreground">
                                  {entry.reason}
                                </p>
                              )}
                            </div>
                            {entry.changedAt && (
                              <DateTime
                                value={entry.changedAt}
                                precision="datetime"
                                language={lang}
                                className="text-2xs text-muted-foreground"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {history.failed && !history.denied && <p role="alert">{t.crmOpportunityDetail.historyLoadFailed}</p>}
                  {!history.denied && (history.nextCursor || history.failed) && (
                    <Button variant="outline" size="sm" disabled={history.loading} onClick={() => void history.loadMore()}>
                      {history.failed ? t.common.retry : t.crmOpportunityDetail.historyLoadMore}
                    </Button>
                  )}
                  {history.loading && <p role="status">{t.common.loading}</p>}

                  <RecordHistoryTab
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
            <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {t.crmOpportunities.importance}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((st) => {
                    const active = st <= localImportance;
                    if (!editable) return <Star key={st} className={cn("size-4", active ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden="true" />;
                    return (
                      <Button
                        key={st}
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={!editable || isSavingCard}
                        onClick={() => {
                          const next = localImportance === st ? 0 : st;
                          void handleCardChange({ importance: next });
                        }}
                        className="h-auto w-auto p-0.5 hover:bg-transparent disabled:cursor-default"
                      >
                        <Star
                          className={cn(
                            "size-4",
                            active
                              ? "fill-warning text-warning"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <span className="mb-2 block text-2xs font-semibold text-muted-foreground">
                  {t.crmLeads.card.cardColor}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {editable && DOSSIER_HEADER_CARD_COLORS.map(({ color, hex }) => {
                    const selected = localCardColor === color;
                    return (
                      <Button
                        key={color ?? "NONE"}
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={!editable || isSavingCard}
                        onClick={() => {
                          const next = selected ? null : color;
                          void handleCardChange({ cardColor: next });
                        }}
                        style={
                          color !== null ? { backgroundColor: hex } : undefined
                        }
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border border-border p-0 transition-transform hover:scale-110",
                          selected &&
                            "ring-2 ring-foreground ring-offset-2",
                        )}
                      >
                        {selected && (
                          <Check className="size-3 text-white" aria-hidden="true" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tags Manager Card */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {t.crmLeads.create.tags}
                </span>
                {editable && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setIsTagPickerOpen((v) => !v)}
                      className="inline-flex h-auto items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-2xs font-semibold text-foreground hover:bg-muted"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      <span>{t.crmOpportunities.selectExistingTags}</span>
                    </Button>
                    {canManageTags && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={isSavingTags}
                        onClick={() => setCreateTagOpen(true)}
                        className="inline-flex h-auto items-center gap-1 rounded-md border border-primary/30 bg-primary-subtle px-2 py-0.5 text-2xs font-semibold text-primary-subtle-foreground hover:bg-primary-subtle/80"
                      >
                        <span>+ {t.crmTags.add}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {localTags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={isSavingTags}
                          onClick={() => void handleRemoveTag(tag.id)}
                          aria-label={`Remove ${tag.name}`}
                          className="h-auto w-auto rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </Button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {editable && isTagPickerOpen && (
                <div className="mt-2.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
                  {availableTags.map((tag) => {
                    const attachedTag = localTags.some((tItem) => tItem.id === tag.id);
                    return (
                      <Button
                        key={tag.id}
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={!editable || isSavingTags}
                        onClick={() =>
                          attachedTag
                            ? void handleRemoveTag(tag.id)
                            : void handleAttachTag(tag)
                        }
                        className="flex h-auto w-full items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-card"
                      >
                        <TagChip
                          label={tag.name}
                          backgroundColor={tag.backgroundColor}
                          textColor={tag.textColor}
                        />
                        {attachedTag && (
                          <Check
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </Button>
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
            <div className="space-y-2.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
              {fallbackDetail.leadSourceName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    {t.crmAcquisitionSources.source}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <AcquisitionSourceIcon
                      source={{ iconUrl: fallbackDetail.leadSourceIconUrl }}
                    />
                    <span>{fallbackDetail.leadSourceName}</span>
                  </span>
                </div>
              )}

              {canOpenActivities && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenActivities(item)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary-subtle py-2 text-xs font-semibold text-primary-subtle-foreground hover:bg-primary-subtle/80"
                >
                  <Activity className="size-3.5" aria-hidden="true" />
                  <span>{t.activities.title}</span>
                </Button>
              )}

              {deletable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onDelete(item);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive-subtle py-2 text-xs font-semibold text-destructive-subtle-foreground hover:bg-destructive-subtle/80"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>{t.crmOpportunities.deleteTitle}</span>
                </Button>
              )}
            </div>
          </aside>
        </div>

        <CreateTagModal
          open={editable && canManageTags && createTagOpen}
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
