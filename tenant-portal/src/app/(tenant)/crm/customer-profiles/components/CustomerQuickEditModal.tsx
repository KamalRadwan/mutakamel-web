"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DOSSIER_CARD_TONE_CLASSES,
  DOSSIER_HEADER_CARD_COLORS,
  DOSSIER_KPI_PILL_CLASSES,
  DOSSIER_TAG_TONE_CLASSES,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type CardColor,
  Field,
  Input,
  cn,
  dossierAvatarClass,
  dossierStageCellClass,
  dossierStatusBadgeClass,
  useToast,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCoreData } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { splitPhoneNumber } from "@/lib/geo/country-data";
import { isUUIDv7 } from "@/lib/uuid";
import { CrmJobTitleField } from "../../shared/components/CrmJobTitleField";
import { CrmPhoneNumberInput } from "../../shared/components/CrmPhoneNumberInput";
import { CrmScopeGate } from "../../shared/components/CrmScopeGate";
import { RecordAttachmentsSection } from "../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../shared/components/RecordNotesSection";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmCustomFieldValues } from "../../shared/hooks/useCrmCustomFieldValues";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../shared/hooks/useCrmRecordCapabilities";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../shared/tag-contract";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsUserName,
  parseLeadDetailsUser,
  type LeadDetailsUser,
} from "../../leads/[id]/lead-details-edit-contract";
import { crmActivityState } from "../../shared/crm-activity-tone";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import {
  CUSTOMER_RELATED_KINDS,
  buildCustomerRelatedHref,
} from "../[id]/customer-profile-related-contract";
import { useCustomerProfileRelatedCounts } from "../[id]/hooks/useCustomerProfileRelatedCounts";
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import type { CustomerCardUpdateResult } from "../hooks/useUpdateCustomerProfileCard";
import type { StatusUpdateResult } from "../hooks/useUpdateCustomerProfileStatus";
import {
  BLACKLISTED_STATUS,
  CUSTOMER_STATUSES,
  parseAddContactResponse,
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../customer-profile-contract";
import {
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";

const USERS_PATH = "/api/tenant/core/v1/users";

export interface CustomerQuickEditModalProps {
  item: CustomerProfileItem | null;
  allItems?: readonly CustomerProfileItem[];
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  allowedOwnerIds?: string[] | null;
  onClose: () => void;
  onSelectCustomer?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => Promise<CustomerCardUpdateResult>;
  onMoveStatus: (item: CustomerProfileItem, status: CustomerProfileStatus) => Promise<StatusUpdateResult | null>;
  onDelete?: (item: CustomerProfileItem) => void;
  onSaved?: () => void;
}

type DossierTab = "activities" | "notes" | "history" | "files";

interface ContactDraft {
  partyId: string | null;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phones: string[];
  isPrimary: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatPhoneDisplay(rawPhone: string): string {
  const split = splitPhoneNumber(rawPhone);
  if (!split) return rawPhone;
  const { callingCode, nationalNumber } = split;
  if (!callingCode) return rawPhone;
  const flagMap: Record<string, string> = {
    "+20": "🇪🇬",
    "+966": "🇸🇦",
    "+971": "🇦🇪",
    "+965": "🇰🇼",
    "+974": "🇶🇦",
    "+973": "🇧🇭",
    "+968": "🇴🇲",
    "+962": "🇯🇴",
    "+1": "🇺🇸",
    "+44": "🇬🇧",
  };
  const flag = flagMap[callingCode] ?? "🌐";
  const grouped = nationalNumber.replace(/(\d{3})(\d{3})(\d+)/u, "$1 $2 $3");
  return `${flag} ${callingCode} ${grouped}`;
}

function formatFullAddress(address: CustomerProfileDetail["address"]): string {
  if (!address) return "—";
  const parts = [
    address.street,
    address.area,
    address.city,
    address.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
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
 * Centered 360° Quick-Edit & Inspector Modal implementing the Dossier 360° Design System
 * for Customer Profiles (100% visual & interaction parity with LeadQuickEditModal).
 */
export function CustomerQuickEditModal({
  item,
  allItems = [],
  canUpdate,
  canDelete,
  allowedOwnerIds = null,
  onClose,
  onSelectCustomer,
  onOpenActivities,
  onCardChange,
  onMoveStatus,
  onDelete,
  onSaved,
}: CustomerQuickEditModalProps) {
  const { t, lang } = useI18n();
  const canReadHistory = useAuditAccess();
  const { canMutate } = useAccessMode();
  const toast = useToast();
  const errorText = useCrmErrorText();
  const itemId = item?.id ?? null;
  const currentItem = useRef(item);
  useEffect(() => {
    currentItem.current = item;
  }, [item]);
  const headerWritePending = useRef(false);
  const router = useRouter();
  const { user: actor } = useTenantAuth();
  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const { items: sources } = useCrmAcquisitionSources();

  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const canReadTags =
    actor?.isTenantOwner === true ||
    (actor?.permissions.includes("crm.tags.read") ?? false);

  const [detail, setDetail] = useState<CustomerProfileDetail | null>(null);
  const [detailLoad, setDetailLoad] = useState<{
    itemId: string;
    status: "ready" | "error" | "forbidden";
  } | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const [localRating, setLocalRating] = useState<number>(item?.rating ?? 0);
  const [localCardColor, setLocalCardColor] = useState<CardColor | null>(
    item?.cardColor ?? null,
  );
  const [localTags, setLocalTags] = useState<CrmTag[]>(item?.tags ?? []);
  const tagWritePending = useRef(false);

  // Section-level edit mode flags (View Mode by default)
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [isEditingQualification, setIsEditingQualification] = useState(false);
  const [editingContactDraft, setEditingContactDraft] =
    useState<ContactDraft | null>(null);
  const [activeDossierTab, setActiveDossierTab] =
    useState<DossierTab>("activities");
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Tag picker state
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);

  // Owner & Users resolution
  const [knownUsers, setKnownUsers] = useState<Map<string, LeadDetailsUser>>(
    new Map(),
  );
  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);

  // Card 1 draft state (Corporate Company Details OR Individual Personal Details)
  const [companyNameDraft, setCompanyNameDraft] = useState("");
  const [companyEmailDraft, setCompanyEmailDraft] = useState("");
  const [taxNumberDraft, setTaxNumberDraft] = useState("");
  const [crNumberDraft, setCrNumberDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [phonesDraft, setPhonesDraft] = useState<string[]>([""]);

  // Individual identity draft state
  const [honorificDraft, setHonorificDraft] = useState("");
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [personalEmailDraft, setPersonalEmailDraft] = useState("");

  // Card 2 draft state (Account Details, Ownership & Custom Fields)
  const [ownerUserIdDraft, setOwnerUserIdDraft] = useState("");
  const [sourceIdDraft, setSourceIdDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [customFieldsDraft, setCustomFieldsDraft] = useState<
    Record<string, unknown>
  >({});

  // Tie readiness to this row so switching customers cannot reuse the previous detail.
  const fallbackDetail =
    detailLoad?.itemId === itemId && detailLoad?.status === "ready" ? detail : null;
  const effectiveBranchId = fallbackDetail?.branchId || item?.branchId || null;
  const attached = useCrmRecordCapabilities(effectiveBranchId);
  const relatedCounts = useCustomerProfileRelatedCounts(
    item?.id ?? null,
    fallbackDetail?.partyId ?? item?.partyId ?? null,
    effectiveBranchId,
  );
  const customFieldValues = useCrmCustomFieldValues(
    effectiveBranchId,
    "CUSTOMER_PROFILE",
    item?.id ?? null,
  );
  const customFieldEntries = customFieldValues.entries;
  const reloadCustomFieldValues = customFieldValues.reload;

  // Only a validated detail response may unlock edits.
  useEffect(() => {
    const item = currentItem.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setDetail(null);
      setDetailLoad(null);
      if (!item) return;
      if (!isUUIDv7(item.id)) setDetailLoad({ itemId: item.id, status: "error" });
      setLocalRating(item.rating);
      setLocalCardColor(item.cardColor);
      setLocalTags(item.tags ?? []);
      setIsEditingIdentity(false);
      setIsEditingQualification(false);
      setEditingContactDraft(null);
      setIsTagPickerOpen(false);
      setSectionError(null);
    });

    if (!item || !isUUIDv7(item.id)) return () => controller.abort();
    void axiosClient
      .get<unknown>(customerProfilePath(item.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        const parsed = parseCustomerProfileDetailResponse(res.data);
        if (parsed.id !== item.id) {
          throw new Error("Unexpected customer profile response.");
        }
        setDetail(parsed);
        setDetailLoad({ itemId: item.id, status: "ready" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const forbidden = normalizeApiError(error).status === 403;
        setDetailLoad({ itemId: item.id, status: forbidden ? "forbidden" : "error" });
      });

    void axiosClient
      .get<unknown>(`${customerProfilePath(item.id)}/tags`, {
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
  }, [itemId, detailReload]);

  const ownerUserIdForLookup = fallbackDetail?.ownerUserId ?? null;
  useEffect(() => {
    if (
      !canReadUsers ||
      !ownerUserIdForLookup ||
      !isUUIDv7(ownerUserIdForLookup)
    ) {
      return;
    }
    const controller = new AbortController();
    void readCoreData(
      `${USERS_PATH}/${encodeURIComponent(ownerUserIdForLookup)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(parseLeadDetailsUser)
      .then((user) => {
        if (!controller.signal.aborted) {
          setKnownUsers((prev) => new Map(prev).set(user.id, user));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [canReadUsers, ownerUserIdForLookup]);

  useEffect(() => {
    if (
      !isEditingQualification ||
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
  }, [allowedOwnerIds, canReadUsers, effectiveBranchId, isEditingQualification]);

  const editable = item && fallbackDetail ? canUpdate(item) : false;
  const deletable = item && fallbackDetail ? canDelete(item) : false;

  const currentIndex = item
    ? allItems.findIndex((entry) => entry.id === item.id)
    : -1;
  const prevCustomer = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextCustomer =
    currentIndex >= 0 && currentIndex < allItems.length - 1
      ? allItems[currentIndex + 1]
      : null;

  // Populate Card 1 drafts when entering Identity/Company Edit Mode
  const startIdentityEdit = useCallback(() => {
    if (!fallbackDetail || !editable) return;
    setSectionError(null);
    setCompanyNameDraft(
      fallbackDetail.companyName || fallbackDetail.displayName || "",
    );
    setCompanyEmailDraft(
      fallbackDetail.companyEmail || fallbackDetail.email || "",
    );
    setTaxNumberDraft(fallbackDetail.taxNumber ?? "");
    setCrNumberDraft(fallbackDetail.commercialRegistrationNumber ?? "");
    setWebsiteDraft(fallbackDetail.companyWebsite ?? "");
    const existingPhones =
      fallbackDetail.phones.length > 0
        ? [...fallbackDetail.phones]
        : fallbackDetail.companyPhone
          ? [fallbackDetail.companyPhone]
          : fallbackDetail.primaryMobile
            ? [fallbackDetail.primaryMobile]
            : [""];
    setPhonesDraft(existingPhones);

    const primaryContact = fallbackDetail.contacts[0];
    setHonorificDraft(primaryContact?.honorificTitle ?? "");
    setFirstNameDraft(
      primaryContact?.firstName ??
        fallbackDetail.displayName.split(" ")[0] ??
        "",
    );
    setLastNameDraft(
      primaryContact?.lastName ??
        fallbackDetail.displayName.split(" ").slice(1).join(" ") ??
        "",
    );
    setDisplayNameDraft(fallbackDetail.displayName || "");
    setPersonalEmailDraft(fallbackDetail.email ?? "");

    setIsEditingIdentity(true);
  }, [fallbackDetail, editable]);

  // Populate Card 2 drafts when entering Account Details Edit Mode
  const startQualificationEdit = useCallback(() => {
    if (!fallbackDetail || !editable) return;
    setSectionError(null);
    setOwnerUserIdDraft(fallbackDetail.ownerUserId ?? "");
    setSourceIdDraft(fallbackDetail.acquisitionSourceId ?? "");
    setDescriptionDraft(fallbackDetail.description ?? "");
    const cfMap: Record<string, unknown> = {};
    for (const entry of customFieldEntries) {
      cfMap[entry.definition.fieldKey] = entry.value?.value ?? "";
    }
    setCustomFieldsDraft(cfMap);
    setIsEditingQualification(true);
  }, [fallbackDetail, editable, customFieldEntries]);

  // Helper to execute PATCH on `/api/tenant/crm/v1/customer-profiles/:id`
  const patchCustomerProfile = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      if (!item || !fallbackDetail || !editable || !isUUIDv7(item.id)) return false;
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: customerProfilePath(item.id),
        body,
        parse: parseCustomerProfileDetailResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });
      if (outcome.kind === "success") {
        setDetail(outcome.value);
        onSaved?.();
        return true;
      }
      setSectionError(
        errorText({ ...outcome.error, message: undefined }) ?? t.crmCustomerProfiles.cardUpdateFailed,
      );
      return false;
    },
    [item, fallbackDetail, editable, onSaved, errorText, t.crmCustomerProfiles.cardUpdateFailed],
  );

  // Save Card 1 (Corporate Company Details OR Individual Personal Info)
  const saveIdentitySection = useCallback(async (): Promise<boolean> => {
    if (!item || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const isCorp = fallbackDetail.profileType === "CORPORATE";
    const cleanedPhones = phonesDraft.map((p) => p.trim()).filter(Boolean);
    const body: Record<string, unknown> = {};

    if (isCorp) {
      if (!companyNameDraft.trim()) {
        setSectionError(
          t.crmCustomerProfiles.ui.quickEdit.company_name_is_required,
        );
        return false;
      }
      body.displayName = companyNameDraft.trim();
      body.companyName = companyNameDraft.trim();
      body.taxNumber = taxNumberDraft.trim();
      body.commercialRegistrationNumber = crNumberDraft.trim();
      if (companyEmailDraft.trim()) {
        body.companyEmail = companyEmailDraft.trim();
      }
      if (websiteDraft.trim()) {
        body.companyWebsite = websiteDraft.trim();
      }
      body.companyPhones = cleanedPhones;
    } else {
      const nextDisplay =
        displayNameDraft.trim() ||
        [firstNameDraft.trim(), lastNameDraft.trim()].filter(Boolean).join(" ");
      if (!nextDisplay) {
        setSectionError(
          t.crmCustomerProfiles.ui.quickEdit.first_name_display_name_is_required,
        );
        return false;
      }
      body.displayName = nextDisplay;
      body.primaryContact = {
        firstName:
          firstNameDraft.trim() || nextDisplay.split(" ")[0] || nextDisplay,
        ...(lastNameDraft.trim() ? { lastName: lastNameDraft.trim() } : {}),
        ...(honorificDraft.trim()
          ? { honorificTitle: honorificDraft.trim() }
          : {}),
        ...(personalEmailDraft.trim()
          ? { email: personalEmailDraft.trim() }
          : {}),
        phones: cleanedPhones,
      };
    }

    setIsSavingSection(true);
    try {
      const ok = await patchCustomerProfile(body);
      if (!ok) return false;
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          companyName: isCorp ? companyNameDraft.trim() : prev.companyName,
          displayName: isCorp
            ? companyNameDraft.trim()
            : displayNameDraft.trim() ||
              [firstNameDraft.trim(), lastNameDraft.trim()]
                .filter(Boolean)
                .join(" ") ||
              prev.displayName,
          email: isCorp ? prev.email : personalEmailDraft.trim() || null,
          companyEmail: isCorp
            ? companyEmailDraft.trim() || null
            : prev.companyEmail,
          taxNumber: isCorp ? taxNumberDraft.trim() || null : prev.taxNumber,
          commercialRegistrationNumber: isCorp
            ? crNumberDraft.trim() || null
            : prev.commercialRegistrationNumber,
          companyWebsite: isCorp
            ? websiteDraft.trim() || null
            : prev.companyWebsite,
          phones: cleanedPhones,
          companyPhone: isCorp ? cleanedPhones[0] ?? null : prev.companyPhone,
          primaryMobile: isCorp ? prev.primaryMobile : cleanedPhones[0] ?? null,
        };
      });
      setIsEditingIdentity(false);
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [
    item,
    fallbackDetail,
    editable,
    phonesDraft,
    companyNameDraft,
    taxNumberDraft,
    crNumberDraft,
    companyEmailDraft,
    websiteDraft,
    displayNameDraft,
    firstNameDraft,
    lastNameDraft,
    honorificDraft,
    personalEmailDraft,
    patchCustomerProfile,
    t.crmCustomerProfiles.ui.quickEdit.company_name_is_required,
    t.crmCustomerProfiles.ui.quickEdit.first_name_display_name_is_required,
  ]);

  // Save Card 2 (Account Details, Ownership & Custom Fields)
  const saveQualificationSection = useCallback(async (): Promise<boolean> => {
    if (!item || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const body: Record<string, unknown> = {
      description: descriptionDraft.trim() || null,
      acquisitionSourceId: sourceIdDraft || null,
    };
    if (ownerUserIdDraft && isUUIDv7(ownerUserIdDraft)) {
      body.ownerUserId = ownerUserIdDraft;
    }
    if (Object.keys(customFieldsDraft).length > 0) {
      body.customFields = customFieldsDraft;
    }

    setIsSavingSection(true);
    try {
      const ok = await patchCustomerProfile(body);
      if (!ok) return false;
      const matchedSource = sources.find((s) => s.id === sourceIdDraft);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              ownerUserId: ownerUserIdDraft || null,
              acquisitionSourceId: sourceIdDraft || null,
              acquisitionSourceNameAr:
                matchedSource?.nameAr ?? prev.acquisitionSourceNameAr,
              acquisitionSourceNameEn:
                matchedSource?.nameEn ?? prev.acquisitionSourceNameEn,
              description: descriptionDraft.trim() || null,
            }
          : prev,
      );
      setIsEditingQualification(false);
      if (Object.keys(customFieldsDraft).length > 0) {
        reloadCustomFieldValues();
      }
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [
    item,
    fallbackDetail,
    editable,
    descriptionDraft,
    sourceIdDraft,
    ownerUserIdDraft,
    customFieldsDraft,
    patchCustomerProfile,
    sources,
    reloadCustomFieldValues,
  ]);

  // Save Contact Person (Add or Edit in Corporate Contact Persons Card)
  const saveContactPerson = useCallback(async (): Promise<boolean> => {
    if (!item || !fallbackDetail || !editingContactDraft || !editable) {
      return false;
    }
    const trimmedFirst = editingContactDraft.firstName.trim();
    const trimmedLast = editingContactDraft.lastName.trim();
    const fullDisplayName = [trimmedFirst, trimmedLast]
      .filter(Boolean)
      .join(" ");
    if (!fullDisplayName) {
      setSectionError(
        t.crmCustomerProfiles.ui.quickEdit.contact_first_name_is_required,
      );
      return false;
    }

    const cleanedPhones = editingContactDraft.phones
      .map((p) => p.trim())
      .filter(Boolean);
    const currentContacts = fallbackDetail.contacts;
    const isAdding = editingContactDraft.partyId === null;
    setIsSavingSection(true);
    try {
      if (isAdding && isUUIDv7(item.id)) {
        const outcome = await runIdempotentWrite({
          attempt: createWriteAttempt(),
          method: "post",
          path: `${customerProfilePath(item.id)}/contacts`,
          body: {
            firstName: trimmedFirst,
            ...(trimmedLast ? { lastName: trimmedLast } : {}),
            ...(editingContactDraft.honorificTitle.trim()
              ? { honorificTitle: editingContactDraft.honorificTitle.trim() }
              : {}),
            ...(editingContactDraft.jobTitle.trim()
              ? { jobTitle: editingContactDraft.jobTitle.trim() }
              : {}),
            ...(editingContactDraft.email.trim()
              ? { email: editingContactDraft.email.trim() }
              : {}),
            ...(cleanedPhones.length > 0 ? { phones: cleanedPhones } : {}),
          },
          parse: parseAddContactResponse,
          config: { maxResponseBytes: 64 * 1024 },
        });
        if (outcome.kind !== "success") {
          setSectionError(
            errorText({ ...outcome.error, message: undefined }) ?? t.crmCustomerProfiles.cardUpdateFailed,
          );
          return false;
        }
        onSaved?.();
      } else {
        const contactsPayload = currentContacts.map((contact) => ({
          contactPartyId: contact.partyId,
          fullName: contact.displayName,
          jobTitle:
            contact.partyId === editingContactDraft.partyId
              ? editingContactDraft.jobTitle.trim() || null
              : contact.jobTitle,
          isPrimary: editingContactDraft.isPrimary
            ? contact.partyId === editingContactDraft.partyId
            : contact.partyId === editingContactDraft.partyId
              ? false
              : contact.isPrimary,
        }));
        const ok = await patchCustomerProfile({ contacts: contactsPayload });
        if (!ok) return false;
      }

      if (isAdding) setDetailReload((value) => value + 1);
      setEditingContactDraft(null);
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [
    item,
    fallbackDetail,
    editingContactDraft,
    editable,
    errorText,
    t.crmCustomerProfiles.cardUpdateFailed,
    t.crmCustomerProfiles.ui.quickEdit.contact_first_name_is_required,
    onSaved,
    patchCustomerProfile,
  ]);

  // Promote a corporate contact to primary directly
  const handleSetPrimaryContact = useCallback(
    async (targetPartyId: string) => {
      if (!item || !fallbackDetail || !editable) return;
      const updated = fallbackDetail.contacts.map((c) => ({
        ...c,
        isPrimary: c.partyId === targetPartyId,
      }));
      await patchCustomerProfile({
        contacts: updated.map((c) => ({
          contactPartyId: c.partyId,
          fullName: c.displayName,
          firstName: c.firstName ?? c.displayName,
          lastName: c.lastName ?? undefined,
          jobTitle: c.jobTitle ?? undefined,
          email: c.email ?? undefined,
          phones: c.phones,
          isPrimary: c.isPrimary,
        })),
      });
    },
    [item, fallbackDetail, editable, patchCustomerProfile],
  );

  // Interactive 3-Star Rating toggle in Header
  const handleToggleRating = useCallback(
    async (starValue: number) => {
      if (!item || !editable || headerWritePending.current) return;
      headerWritePending.current = true;
      setSectionError(null);
      const nextRating = localRating === starValue ? 0 : starValue;
      setLocalRating(nextRating);
      try {
        const result = await onCardChange(item, { rating: nextRating });
        if (currentItem.current?.id !== item.id) return;
        setLocalRating(result.ok ? result.patch.rating ?? nextRating : localRating);
        if (!result.ok && result.error) setSectionError(errorText({ ...result.error, message: undefined }));
      } finally {
        headerWritePending.current = false;
      }
    },
    [item, editable, localRating, onCardChange, errorText],
  );

  // Interactive Board Card Color Picker in Header ("No color" first + 5 colors)
  const handleSelectCardColor = useCallback(
    async (color: CardColor | null) => {
      if (!item || !editable || headerWritePending.current) return;
      headerWritePending.current = true;
      setSectionError(null);
      const nextColor =
        color === null ? null : localCardColor === color ? null : color;
      setLocalCardColor(nextColor);
      try {
        const result = await onCardChange(item, { cardColor: nextColor });
        if (currentItem.current?.id !== item.id) return;
        setLocalCardColor(result.ok ? result.patch.cardColor ?? null : localCardColor);
        if (!result.ok && result.error) setSectionError(errorText({ ...result.error, message: undefined }));
      } finally {
        headerWritePending.current = false;
      }
    },
    [item, editable, localCardColor, onCardChange, errorText],
  );

  // Attach / Detach Tag handlers
  const handleOpenTagPicker = useCallback(() => {
    if (!editable || !canReadTags) return;
    setIsTagPickerOpen((prev) => !prev);
    if (availableTags.length === 0) {
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, {
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((res) => {
          setAvailableTags(parseCrmTagCatalogue(res.data));
        })
        .catch(() => {
          setIsTagPickerOpen(false);
          toast.error(t.crmTags.loadFailed);
        });
    }
  }, [editable, canReadTags, availableTags.length, t.crmTags.loadFailed, toast]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!item || !editable || tagWritePending.current) return;
      if (!isUUIDv7(item.id) || !isUUIDv7(tag.id)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = localTags;
      if (previousTags.some((existing) => existing.id === tag.id)) return;
      tagWritePending.current = true;
      setLocalTags([...previousTags, tag]);
      setIsTagPickerOpen(false);
      try {
        const res = await axiosClient.post<unknown>(
          `${customerProfilePath(item.id)}/tags`,
          { tagIds: [tag.id] },
          { skipAutoIdempotency: true },
        );
        if (!Array.isArray(res.data)) throw new Error("INVALID_CRM_TAGS_RESPONSE");
        setLocalTags(parseCrmTags(res.data));
        onSaved?.();
      } catch {
        setLocalTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [item, editable, localTags, onSaved, t, toast],
  );

  const handleDetachTag = useCallback(
    async (tagId: string) => {
      if (!item || !editable || tagWritePending.current) return;
      if (!isUUIDv7(item.id) || !isUUIDv7(tagId)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = localTags;
      tagWritePending.current = true;
      setLocalTags(previousTags.filter((existing) => existing.id !== tagId));
      try {
        await axiosClient.delete(
          `${customerProfilePath(item.id)}/tags/${encodeURIComponent(tagId)}`,
        );
        onSaved?.();
      } catch {
        setLocalTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [item, editable, localTags, onSaved, t, toast],
  );

  // Save & Close [Ctrl+S] handler
  const handleSaveAndClose = useCallback(async () => {
    if (!item || !fallbackDetail || !editable || isSavingSection) return;
    if (isEditingIdentity) {
      const ok = await saveIdentitySection();
      if (!ok) return;
    }
    if (isEditingQualification) {
      const ok = await saveQualificationSection();
      if (!ok) return;
    }
    if (editingContactDraft) {
      const ok = await saveContactPerson();
      if (!ok) return;
    }
    onClose();
  }, [
    item,
    fallbackDetail,
    editable,
    isSavingSection,
    isEditingIdentity,
    isEditingQualification,
    editingContactDraft,
    saveIdentitySection,
    saveQualificationSection,
    saveContactPerson,
    onClose,
  ]);

  useEffect(() => {
    if (!item) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // The loading/error dialog handles its own Escape key.
        if (fallbackDetail) onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveAndClose();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "j" && prevCustomer && onSelectCustomer) {
        onSelectCustomer(prevCustomer);
      }
      if (e.key.toLowerCase() === "k" && nextCustomer && onSelectCustomer) {
        onSelectCustomer(nextCustomer);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    item,
    prevCustomer,
    nextCustomer,
    onClose,
    onSelectCustomer,
    handleSaveAndClose,
    fallbackDetail,
  ]);

  if (!item) return null;
  if (!fallbackDetail) {
    const loadStatus = detailLoad?.itemId === itemId ? detailLoad?.status : null;
    const loadFailed = loadStatus === "error" || loadStatus === "forbidden";
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>{item.displayName}</DialogTitle>
          <DialogDescription
            role={loadFailed ? "alert" : "status"}
            aria-busy={!loadFailed}
          >
            {loadStatus === "forbidden"
              ? t.crmShared.scopeDeniedDescription
              : loadFailed
                ? t.crmCustomerProfiles.loadFailed
                : t.crmCustomerProfiles.loading}
          </DialogDescription>
          {loadStatus === "forbidden" && <CrmScopeGate />}
          <div className="flex gap-2">
            {loadFailed && (
              <Button
                variant="outline"
                onClick={() => {
                  setDetailLoad(null);
                  setDetailReload((value) => value + 1);
                }}
              >
                {t.common.retry}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {t.common.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isCorporate = fallbackDetail.profileType === "CORPORATE";
  const currentStatus = fallbackDetail.status;
  const currentStatusIndex = CUSTOMER_STATUSES.indexOf(currentStatus);
  const isBlacklisted = currentStatus === BLACKLISTED_STATUS;

  const sourceLabel =
    localizedValue(
      fallbackDetail.acquisitionSourceNameAr,
      fallbackDetail.acquisitionSourceNameEn,
      lang,
    ) ||
    localizedValue(
      item.acquisitionSourceNameAr,
      item.acquisitionSourceNameEn,
      lang,
    ) ||
    "—";

  const ownerFromRef = leadDetailsUserName(
    knownUsers.get(fallbackDetail.ownerUserId ?? ""),
  );
  const ownerDisplayName =
    ownerFromRef ||
    (item.owner
      ? `${item.owner.firstName} ${item.owner.lastName}`.trim()
      : "") ||
    (t.crmCustomerProfiles.ui.quickEdit.unassigned);

  const locationDisplay = [
    fallbackDetail.address?.city ?? item.city,
    fallbackDetail.address?.country ?? item.country,
  ]
    .filter(Boolean)
    .join(", ");

  const activityState = crmActivityState(item.nextActivity);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Quick Edit ${fallbackDetail.displayName}`}
      className="dossier-backdrop fixed inset-0 z-(--z-overlay) flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="dossier-modal flex max-h-[94vh] w-full max-w-[1460px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= 1. TOP EXECUTIVE HEADER ================= */}
        <div className="dossier-header">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className={dossierAvatarClass(isCorporate, isBlacklisted)}>
              {getInitials(fallbackDetail.displayName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="dossier-title truncate">
                  {fallbackDetail.displayName}
                </h2>

                {/* Corporate vs Individual Badge */}
                <span
                  className={cn(
                    "dossier-badge",
                    isCorporate
                      ? "dossier-badge-corporate"
                      : "dossier-badge-individual",
                  )}
                >
                  {isCorporate
                    ? t.crmCustomerProfiles.ui.quickEdit.corporate_customer
                    : t.crmCustomerProfiles.ui.quickEdit.individual_customer}
                </span>

                {/* Customer Status Badge */}
                <span
                  className={dossierStatusBadgeClass(
                    currentStatus === "ACTIVE_CUSTOMER"
                      ? "CONVERTED"
                      : currentStatus === "BLACKLISTED"
                        ? "DISQUALIFIED"
                        : currentStatus === "INACTIVE"
                          ? "ON_HOLD"
                          : "OPEN",
                  )}
                >
                  {currentStatus === "ACTIVE_CUSTOMER"
                    ? `✓ Status: ${statusLabels[`CustomerStatus.${currentStatus}`] ?? currentStatus}`
                    : `● Status: ${statusLabels[`CustomerStatus.${currentStatus}`] ?? currentStatus}`}
                </span>

                {/* Interactive 3-Star Rating */}
                <div
                  className="dossier-stars"
                  role="group"
                  aria-label={t.crmCustomerProfiles.ui.quickEdit.customer_rating}
                >
                  {[1, 2, 3].map((starNum) => {
                    const active = starNum <= localRating;
                    return (
                      <Button
                        key={starNum}
                        type="button"
                        disabled={!editable}
                        onClick={() => handleToggleRating(starNum)}
                        aria-label={`Rate ${starNum} of 3 stars`}
                        aria-pressed={active}
                        className={cn(
                          "dossier-star border-0 bg-transparent p-0",
                          !active && "off",
                          !editable && "cursor-default opacity-75",
                        )}
                      >
                        ★
                      </Button>
                    );
                  })}
                </div>

                {/* Interactive Board Card Color Picker Dots ("No Color" first + 5 colors) */}
                <div
                  className="dossier-color-dots"
                  role="group"
                  aria-label={t.crmCustomerProfiles.ui.quickEdit.card_color}
                >
                  {DOSSIER_HEADER_CARD_COLORS.map((opt) => {
                    const isNone = opt.color === null;
                    const isActive = localCardColor === opt.color;
                    return (
                      <Button
                        key={opt.color ?? "NONE"}
                        type="button"
                        disabled={!editable}
                        onClick={() => handleSelectCardColor(opt.color)}
                        title={
                          isNone
                            ? t.crmCustomerProfiles.ui.quickEdit.no_color
                            : localizedValue(
                                opt.labelAr,
                                opt.labelEn,
                                lang,
                              )
                        }
                        aria-label={`Card color ${opt.labelEn}`}
                        aria-pressed={isActive}
                        className={cn(
                          "dossier-color-dot p-0",
                          isNone ? "dossier-color-dot-none" : "border-0",
                          isActive && "active",
                          !editable && "cursor-default opacity-60",
                        )}
                        style={isNone ? undefined : { background: opt.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Clean Subtitle Metadata Row */}
              <div className="dossier-subtitle">
                {locationDisplay && (
                  <>
                    <span>📍 {locationDisplay}</span>
                    <span className="sep">•</span>
                  </>
                )}
                <span>
                  Source: <b>{sourceLabel}</b>
                </span>
                <span className="sep">•</span>
                <span>
                  👤 Salesperson: <b>{ownerDisplayName}</b>
                </span>
                <span className="sep">•</span>
                <span>
                  🕒 Created:{" "}
                  <b>
                    {new Date(fallbackDetail.createdAt).toLocaleDateString(
                      lang,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </b>
                </span>
              </div>
            </div>
          </div>

          {/* Right Header KPI Counter Pills & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {CUSTOMER_RELATED_KINDS.filter(
              (kind) => relatedCounts.permitted[kind],
            ).map((kind) => (
              <Link
                key={kind}
                href={buildCustomerRelatedHref(kind, fallbackDetail.partyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES[kind]}
              >
                {t.crmLeadDetail.related.labels[kind]}{" "}
                <b>
                  {relatedCounts.counts[kind] === null
                    ? relatedCounts.isLoading
                      ? "\u2026"
                      : "\u2014"
                    : new Intl.NumberFormat(
                        lang,
                      ).format(relatedCounts.counts[kind])}
                </b>
              </Link>
            ))}

            <Button
              type="button"
              onClick={() => {
                onClose();
                router.push(
                  `/crm/customer-profiles/${encodeURIComponent(fallbackDetail.id)}`,
                );
              }}
              className="dossier-btn dossier-btn-outline"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span>{t.crmCustomerProfiles.ui.quickEdit.open_full_page}</span>
            </Button>

            <Button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="dossier-close"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* ================= 2. FULL 4-STATUS PIPELINE STEPPER BAR ================= */}
        <div className="dossier-stage-bar">
          <div className="dossier-stage-track">
            {CUSTOMER_STATUSES.map((status, idx) => {
              const isCurrent = status === currentStatus;
              const isDone =
                currentStatusIndex >= 0 &&
                idx < currentStatusIndex &&
                status !== BLACKLISTED_STATUS;
              const statusName =
                statusLabels[`CustomerStatus.${status}`] ?? status;
              const mappedFlag =
                status === "ACTIVE_CUSTOMER"
                  ? "CONVERTED"
                  : status === "BLACKLISTED"
                    ? "DISQUALIFIED"
                    : status === "INACTIVE"
                      ? "ON_HOLD"
                      : "NEW";

              return (
                <Button
                  key={status}
                  type="button"
                  disabled={!editable || isCurrent}
                  onClick={async () => {
                    if (headerWritePending.current) return;
                    headerWritePending.current = true;
                    setSectionError(null);
                    try {
                      const result = await onMoveStatus(item, status);
                      if (currentItem.current?.id !== item.id || !result) return;
                      if (!result.ok) {
                        setSectionError(errorText({ ...result.error, message: undefined }));
                        return;
                      }
                      setDetail((prev) =>
                        prev ? { ...prev, status } : prev,
                      );
                    } finally {
                      headerWritePending.current = false;
                    }
                  }}
                  className={dossierStageCellClass({
                    flag: mappedFlag,
                    isCurrent,
                    isPast: isDone && !isCurrent,
                  })}
                >
                  {isDone && !isCurrent && (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {isCurrent
                      ? `● ${statusName} (${t.crmCustomerProfiles.ui.quickEdit.current})`
                      : statusName}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* ================= 3. BLACKLISTED WARNING BANNER ================= */}
        {isBlacklisted && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive">
            <Ban className="size-4 shrink-0" />
            <span>
              {t.crmCustomerProfiles.ui.quickEdit.blacklisted_warning}
            </span>
          </div>
        )}

        {/* Section Validation / Write Error Alert */}
        {sectionError && (
          <div
            role="alert"
            className="mx-5 mt-3 rounded-lg border border-destructive bg-destructive-subtle px-3.5 py-2 text-xs font-semibold text-destructive-subtle-foreground"
          >
            {sectionError}
          </div>
        )}

        {/* ================= 4. TWO-COLUMN DOSSIER BODY ================= */}
        <div className="dossier-body">
          {/* ---------------- LEFT COLUMN (7/12) ---------------- */}
          <div className="dossier-col">
            {/* CARD 1A: CORPORATE COMPANY DETAILS (Shown ONLY when CORPORATE) */}
            {isCorporate ? (
              <div
                className={
                  isEditingIdentity
                    ? DOSSIER_CARD_TONE_CLASSES.indigo.cardEditing
                    : DOSSIER_CARD_TONE_CLASSES.indigo.card
                }
              >
                <div className="dossier-card-head">
                  <div className="dossier-card-title">
                    <span className="dossier-card-icon">🏢</span>
                    <span>
                      {isEditingIdentity
                        ? t.crmCustomerProfiles.ui.quickEdit.editing_company_details_phones
                        : t.crmCustomerProfiles.ui.quickEdit.company_details}
                    </span>
                  </div>
                  {isEditingIdentity ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => {
                          setIsEditingIdentity(false);
                          setSectionError(null);
                        }}
                        className="dossier-edit-btn dossier-cancel-btn"
                      >
                        ✕ {t.crmCustomerProfiles.ui.quickEdit.cancel}
                      </Button>
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => void saveIdentitySection()}
                        className="dossier-edit-btn dossier-save-btn"
                      >
                        ✓ {t.crmCustomerProfiles.ui.quickEdit.save_company}
                      </Button>
                    </div>
                  ) : (
                    editable && (
                      <Button
                        type="button"
                        onClick={startIdentityEdit}
                        className="dossier-edit-btn"
                      >
                        ✏️{" "}
                        {t.crmCustomerProfiles.ui.quickEdit.edit_company_details}
                      </Button>
                    )
                  )}
                </div>

                <div className="dossier-card-body">
                  {!isEditingIdentity ? (
                    <>
                      {/* Company Phones in View Mode with Edit Button & Call/WA/TG */}
                      <div className="dossier-phone-box-view">
                        <div className="dossier-phone-box-head">
                          <span className="dossier-phone-box-label">
                            📞 Company Phone Numbers (companyPhones — View Mode)
                          </span>
                          {editable && (
                            <Button
                              type="button"
                              onClick={startIdentityEdit}
                              className="dossier-edit-btn"
                            >
                              ✏️{" "}
                              {t.crmCustomerProfiles.ui.quickEdit.edit_phones_code_number}
                            </Button>
                          )}
                        </div>
                        {fallbackDetail.phones.length > 0 ? (
                          fallbackDetail.phones.map((ph, idx) => (
                            <div
                              key={`${ph}-${idx}`}
                              className="dossier-phone-item-view"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="dossier-phone-num" dir="ltr">
                                  {formatPhoneDisplay(ph)}
                                </span>
                                <span
                                  className={cn(
                                    "dossier-phone-tag",
                                    idx > 0 && "secondary",
                                  )}
                                >
                                  {idx === 0 ? "Primary Phone" : "Secondary"}
                                </span>
                              </div>
                              <PhoneActionPills
                                phone={ph}
                                country={
                                  fallbackDetail.address?.country ??
                                  item.country
                                }
                              />
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {t.crmCustomerProfiles.ui.quickEdit.no_company_phone_numbers_recorded}
                          </div>
                        )}
                      </div>

                      {/* Company Fields Grid (View Mode) */}
                      <div className="dossier-grid-2">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Company Name</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.companyName ||
                              fallbackDetail.displayName}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Company Email
                          </div>
                          <div className="dossier-field-val">
                            {fallbackDetail.companyEmail ||
                            fallbackDetail.email ? (
                              <a
                                href={`mailto:${fallbackDetail.companyEmail || fallbackDetail.email}`}
                              >
                                ✉️{" "}
                                {fallbackDetail.companyEmail ||
                                  fallbackDetail.email}
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Tax Number</div>
                          <div className="dossier-field-val mono">
                            {fallbackDetail.taxNumber || (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Commercial Reg. No.
                          </div>
                          <div className="dossier-field-val mono">
                            {fallbackDetail.commercialRegistrationNumber || (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Company Website
                          </div>
                          <div className="dossier-field-val">
                            {fallbackDetail.companyWebsite ? (
                              <a
                                href={
                                  fallbackDetail.companyWebsite.startsWith(
                                    "http",
                                  )
                                    ? fallbackDetail.companyWebsite
                                    : `https://${fallbackDetail.companyWebsite}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                🌐 {fallbackDetail.companyWebsite} ↗
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Country / City / Area
                          </div>
                          <div className="dossier-field-val">
                            {[
                              fallbackDetail.address?.country ?? item.country,
                              fallbackDetail.address?.city ?? item.city,
                              fallbackDetail.address?.area,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="dossier-field-box dossier-span-all">
                          <div className="dossier-field-label">
                            Full Legal Address
                          </div>
                          <div className="dossier-field-val">
                            📍 {formatFullAddress(fallbackDetail.address)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* CORPORATE EDIT MODE */
                    <>
                      <div className="dossier-phone-box-edit">
                        <div className="dossier-phone-box-head">
                          <span className="dossier-phone-box-label">
                            📞 Company Phones — Split Country Code + National
                            Number (CrmPhoneNumberInput)
                          </span>
                          {phonesDraft.length < 10 && (
                            <Button
                              type="button"
                              onClick={() =>
                                setPhonesDraft((prev) => [...prev, ""])
                              }
                              className="dossier-add-phone-btn"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>
                                {t.crmCustomerProfiles.ui.quickEdit.add_phone}
                              </span>
                            </Button>
                          )}
                        </div>
                        {phonesDraft.map((ph, idx) => (
                          <div key={idx} className="dossier-phone-split-row">
                            <CrmPhoneNumberInput
                              value={ph}
                              maxLength={32}
                              label={`Company Phone ${idx + 1}`}
                              placeholder="1050049899"
                              onChange={(next) =>
                                setPhonesDraft((prev) =>
                                  prev.map((entry, i) =>
                                    i === idx ? next : entry,
                                  ),
                                )
                              }
                              onBlur={() => {}}
                            />
                            <span
                              className={cn(
                                "dossier-phone-tag",
                                idx > 0 && "secondary",
                              )}
                            >
                              {idx === 0 ? "Primary" : `#${idx + 1}`}
                            </span>
                            <Button
                              type="button"
                              aria-label={`Remove phone ${idx + 1}`}
                              onClick={() =>
                                setPhonesDraft((prev) =>
                                  prev.length === 1
                                    ? [""]
                                    : prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="dossier-del-btn"
                            >
                              <Trash2
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        ))}
                        <div className="dossier-phone-hint">
                          ✓ Automatically strips leading trunk 0 • Splits pasted
                          international numbers (+20 / 0020) • Validates E.164
                          format
                        </div>
                      </div>

                      <div className="dossier-grid-2">
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="corp-company-name"
                          >
                            Company Name *
                          </label>
                          <input
                            id="corp-company-name"
                            className="dossier-input"
                            value={companyNameDraft}
                            onChange={(e) =>
                              setCompanyNameDraft(e.target.value)
                            }
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="corp-company-email"
                          >
                            Company Email
                          </label>
                          <input
                            id="corp-company-email"
                            className="dossier-input"
                            value={companyEmailDraft}
                            onChange={(e) =>
                              setCompanyEmailDraft(e.target.value)
                            }
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="corp-tax-number"
                          >
                            Tax Number
                          </label>
                          <input
                            id="corp-tax-number"
                            className="dossier-input mono"
                            value={taxNumberDraft}
                            onChange={(e) => setTaxNumberDraft(e.target.value)}
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="corp-cr-number"
                          >
                            Commercial Reg. No.
                          </label>
                          <input
                            id="corp-cr-number"
                            className="dossier-input mono"
                            value={crNumberDraft}
                            onChange={(e) => setCrNumberDraft(e.target.value)}
                          />
                        </div>
                        <div className="dossier-field-box dossier-span-all">
                          <label
                            className="dossier-field-label"
                            htmlFor="corp-website"
                          >
                            Company Website
                          </label>
                          <input
                            id="corp-website"
                            className="dossier-input"
                            value={websiteDraft}
                            onChange={(e) => setWebsiteDraft(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="dossier-field-box dossier-span-all">
                        <Field
                          label={t.crmLeads.create.sections.address}
                          hint={t.crmCustomerProfileActions.addressReadOnly}
                          readOnly
                          showLabel
                        >
                          <Input
                            size="sm"
                            value={formatFullAddress(fallbackDetail.address)}
                            readOnly
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* CARD 1B: INDIVIDUAL PERSONAL & CONTACT INFORMATION */
              <div
                className={
                  isEditingIdentity
                    ? DOSSIER_CARD_TONE_CLASSES.violet.cardEditing
                    : DOSSIER_CARD_TONE_CLASSES.violet.card
                }
              >
                <div className="dossier-card-head">
                  <div className="dossier-card-title">
                    <span className="dossier-card-icon">👤</span>
                    <span>
                      {isEditingIdentity
                        ? t.crmCustomerProfiles.ui.quickEdit.editing_personal_contact_information
                        : t.crmCustomerProfiles.ui.quickEdit.personal_contact_information}
                    </span>
                  </div>
                  {isEditingIdentity ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => {
                          setIsEditingIdentity(false);
                          setSectionError(null);
                        }}
                        className="dossier-edit-btn dossier-cancel-btn"
                      >
                        ✕ {t.crmCustomerProfiles.ui.quickEdit.cancel}
                      </Button>
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => void saveIdentitySection()}
                        className="dossier-edit-btn dossier-save-btn"
                      >
                        ✓{" "}
                        {t.crmCustomerProfiles.ui.quickEdit.save_personal_info}
                      </Button>
                    </div>
                  ) : (
                    editable && (
                      <Button
                        type="button"
                        onClick={startIdentityEdit}
                        className="dossier-edit-btn"
                      >
                        ✏️{" "}
                        {t.crmCustomerProfiles.ui.quickEdit.edit_personal_info}
                      </Button>
                    )
                  )}
                </div>

                <div className="dossier-card-body">
                  {!isEditingIdentity ? (
                    <>
                      {/* Personal Mobile Numbers in View Mode */}
                      <div className="dossier-phone-box-view">
                        <div className="dossier-phone-box-head">
                          <span className="dossier-phone-box-label">
                            📱 Personal Mobile Numbers (phones[] — View Mode)
                          </span>
                          {editable && (
                            <Button
                              type="button"
                              onClick={startIdentityEdit}
                              className="dossier-edit-btn"
                            >
                              ✏️{" "}
                              {t.crmCustomerProfiles.ui.quickEdit.edit_phones_code_number}
                            </Button>
                          )}
                        </div>
                        {fallbackDetail.phones.length > 0 ? (
                          fallbackDetail.phones.map((ph, idx) => (
                            <div
                              key={`${ph}-${idx}`}
                              className="dossier-phone-item-view"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="dossier-phone-num" dir="ltr">
                                  {formatPhoneDisplay(ph)}
                                </span>
                                <span
                                  className={cn(
                                    "dossier-phone-tag",
                                    idx > 0 && "secondary",
                                  )}
                                >
                                  {idx === 0 ? "Primary Mobile" : "Secondary"}
                                </span>
                              </div>
                              <PhoneActionPills
                                phone={ph}
                                country={
                                  fallbackDetail.address?.country ??
                                  item.country
                                }
                              />
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {t.crmCustomerProfiles.ui.quickEdit.no_mobile_numbers_recorded}
                          </div>
                        )}
                      </div>

                      <div className="dossier-grid-4">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Honorific Title
                          </div>
                          <div className="dossier-field-val">
                            {fallbackDetail.contacts[0]?.honorificTitle || (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">First Name</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.contacts[0]?.firstName ||
                              fallbackDetail.displayName.split(" ")[0] ||
                              "—"}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Last Name</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.contacts[0]?.lastName ||
                              fallbackDetail.displayName
                                .split(" ")
                                .slice(1)
                                .join(" ") ||
                              "—"}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Display Name
                          </div>
                          <div className="dossier-field-val">
                            {fallbackDetail.displayName}
                          </div>
                        </div>
                      </div>

                      <div className="dossier-grid-2">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Personal Email
                          </div>
                          <div className="dossier-field-val">
                            {fallbackDetail.email ? (
                              <a href={`mailto:${fallbackDetail.email}`}>
                                ✉️ {fallbackDetail.email}
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">
                            Country / City / Area
                          </div>
                          <div className="dossier-field-val">
                            {[
                              fallbackDetail.address?.country ?? item.country,
                              fallbackDetail.address?.city ?? item.city,
                              fallbackDetail.address?.area,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="dossier-field-box dossier-span-all">
                          <div className="dossier-field-label">
                            Personal Address
                          </div>
                          <div className="dossier-field-val">
                            📍 {formatFullAddress(fallbackDetail.address)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* INDIVIDUAL EDIT MODE */
                    <>
                      <div className="dossier-grid-4">
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ind-honorific"
                          >
                            Honorific Title
                          </label>
                          <select
                            id="ind-honorific"
                            className="dossier-select"
                            value={
                              findHonorific(honorificDraft, lang)?.label ??
                              honorificDraft
                            }
                            onChange={(e) => setHonorificDraft(e.target.value)}
                          >
                            <option value="">
                              {t.crmCustomerProfiles.ui.quickEdit.none}
                            </option>
                            {getHonorificOptions(lang).map((opt) => (
                              <option key={opt.key} value={opt.label}>
                                {opt.label}
                              </option>
                            ))}
                            {honorificDraft &&
                              !findHonorific(honorificDraft, lang) && (
                                <option value={honorificDraft}>
                                  {honorificDraft}
                                </option>
                              )}
                          </select>
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ind-first-name"
                          >
                            First Name *
                          </label>
                          <input
                            id="ind-first-name"
                            className="dossier-input"
                            value={firstNameDraft}
                            onChange={(e) => setFirstNameDraft(e.target.value)}
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ind-last-name"
                          >
                            Last Name
                          </label>
                          <input
                            id="ind-last-name"
                            className="dossier-input"
                            value={lastNameDraft}
                            onChange={(e) => setLastNameDraft(e.target.value)}
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ind-display-name"
                          >
                            Display Name
                          </label>
                          <input
                            id="ind-display-name"
                            className="dossier-input"
                            value={displayNameDraft}
                            onChange={(e) =>
                              setDisplayNameDraft(e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="dossier-phone-box-edit">
                        <div className="dossier-phone-box-head">
                          <span className="dossier-phone-box-label">
                            📱 Personal Mobile Numbers — Split Country Code +
                            National Number (CrmPhoneNumberInput)
                          </span>
                          {phonesDraft.length < 10 && (
                            <Button
                              type="button"
                              onClick={() =>
                                setPhonesDraft((prev) => [...prev, ""])
                              }
                              className="dossier-add-phone-btn"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>
                                {t.crmCustomerProfiles.ui.quickEdit.add_mobile}
                              </span>
                            </Button>
                          )}
                        </div>
                        {phonesDraft.map((ph, idx) => (
                          <div key={idx} className="dossier-phone-split-row">
                            <CrmPhoneNumberInput
                              value={ph}
                              maxLength={32}
                              label={`Personal Mobile ${idx + 1}`}
                              placeholder="1112223344"
                              onChange={(next) =>
                                setPhonesDraft((prev) =>
                                  prev.map((entry, i) =>
                                    i === idx ? next : entry,
                                  ),
                                )
                              }
                              onBlur={() => {}}
                            />
                            <span
                              className={cn(
                                "dossier-phone-tag",
                                idx > 0 && "secondary",
                              )}
                            >
                              {idx === 0 ? "Primary Mobile" : "Secondary"}
                            </span>
                            <Button
                              type="button"
                              aria-label={`Remove mobile ${idx + 1}`}
                              onClick={() =>
                                setPhonesDraft((prev) =>
                                  prev.length === 1
                                    ? [""]
                                    : prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="dossier-del-btn"
                            >
                              <Trash2
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        ))}
                        <div className="dossier-phone-hint">
                          ✓ Automatically strips leading trunk 0 • Splits pasted
                          international numbers • Validates E.164 format
                        </div>
                      </div>

                      <div className="dossier-grid-4">
                        <div className="dossier-field-box dossier-span-2">
                          <label
                            className="dossier-field-label"
                            htmlFor="ind-email"
                          >
                            Personal Email
                          </label>
                          <input
                            id="ind-email"
                            className="dossier-input"
                            value={personalEmailDraft}
                            onChange={(e) =>
                              setPersonalEmailDraft(e.target.value)
                            }
                          />
                        </div>
                        <div className="dossier-field-box dossier-span-all">
                          <Field
                            label={t.crmLeads.create.sections.address}
                            hint={t.crmCustomerProfileActions.addressReadOnly}
                            readOnly
                            showLabel
                          >
                            <Input
                              size="sm"
                              value={formatFullAddress(fallbackDetail.address)}
                              readOnly
                            />
                          </Field>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* CARD 2: ACCOUNT DETAILS, OWNERSHIP & CUSTOM FIELDS */}
            <div
              className={
                isEditingQualification
                  ? DOSSIER_CARD_TONE_CLASSES.violet.cardEditing
                  : DOSSIER_CARD_TONE_CLASSES.violet.card
              }
            >
              <div className="dossier-card-head">
                <div className="dossier-card-title">
                  <span className="dossier-card-icon">🎯</span>
                  <span>
                    {isEditingQualification
                      ? t.crmCustomerProfiles.ui.quickEdit.editing_account_details_ownership_custom_fields
                      : t.crmCustomerProfiles.ui.quickEdit.account_details_ownership_custom_fields}
                  </span>
                </div>
                {isEditingQualification ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={isSavingSection}
                      onClick={() => {
                        setIsEditingQualification(false);
                        setSectionError(null);
                      }}
                      className="dossier-edit-btn dossier-cancel-btn"
                    >
                      ✕ {t.crmCustomerProfiles.ui.quickEdit.cancel}
                    </Button>
                    <Button
                      type="button"
                      disabled={isSavingSection}
                      onClick={() => void saveQualificationSection()}
                      className="dossier-edit-btn dossier-save-btn"
                    >
                      ✓ {t.crmCustomerProfiles.ui.quickEdit.save_details}
                    </Button>
                  </div>
                ) : (
                  editable && (
                    <Button
                      type="button"
                      onClick={startQualificationEdit}
                      className="dossier-edit-btn"
                    >
                      ✏️ {t.crmCustomerProfiles.ui.quickEdit.edit_details}
                    </Button>
                  )
                )}
              </div>

              <div className="dossier-card-body">
                {!isEditingQualification ? (
                  <>
                    <div className="dossier-grid-3">
                      <div className="dossier-field-box">
                        <div className="dossier-field-label">
                          Salesperson (Owner)
                        </div>
                        <div className="dossier-field-val">
                          👤 {ownerDisplayName}
                        </div>
                      </div>
                      <div className="dossier-field-box">
                        <div className="dossier-field-label">
                          Acquisition Source
                        </div>
                        <div className="dossier-field-val">
                          🌐 {sourceLabel}
                        </div>
                      </div>
                      <div className="dossier-field-box">
                        <div className="dossier-field-label">Updated At</div>
                        <div className="dossier-field-val">
                          {new Date(
                            fallbackDetail.updatedAt,
                          ).toLocaleDateString(lang, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="dossier-grid-2">
                      {fallbackDetail.sourceLeadId && (
                        <div className="dossier-field-box dossier-span-all">
                          <div className="dossier-field-label">Source Lead</div>
                          <div className="dossier-field-val">
                            <Button
                              type="button"
                              onClick={() => {
                                onClose();
                                router.push(
                                  `/crm/leads/${encodeURIComponent(fallbackDetail.sourceLeadId!)}`,
                                );
                              }}
                              className="text-primary underline hover:text-primary/80"
                            >
                              🔗 {t.crmCustomerProfiles.ui.quickEdit.view_source_lead}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="dossier-field-box dossier-span-all">
                        <div className="dossier-field-label">
                          Description / Internal Notes
                        </div>
                        <div className="dossier-field-val">
                          {fallbackDetail.description || (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </div>

                      {/* Customer Tags Row */}
                      <div className="dossier-field-box dossier-span-all">
                        <div className="dossier-field-label">Customer Tags</div>
                        <div className="dossier-tags">
                          {localTags.map((tag, idx) => {
                            const toneClass =
                              DOSSIER_TAG_TONE_CLASSES[
                                idx % DOSSIER_TAG_TONE_CLASSES.length
                              ];
                            return (
                              <span
                                key={tag.id}
                                className={toneClass}
                                style={
                                  tag.backgroundColor && tag.textColor
                                    ? {
                                        backgroundColor: tag.backgroundColor,
                                        color: tag.textColor,
                                      }
                                    : undefined
                                }
                              >
                                🏷️ {tag.name}
                                {editable && (
                                  <Button
                                    type="button"
                                    aria-label={`Remove tag ${tag.name}`}
                                    onClick={() =>
                                      void handleDetachTag(tag.id)
                                    }
                                    className="ms-1 border-0 bg-transparent p-0 font-semibold opacity-75 hover:opacity-100"
                                  >
                                    ×
                                  </Button>
                                )}
                              </span>
                            );
                          })}
                          {editable && canReadTags && (
                            <Button
                              type="button"
                              onClick={handleOpenTagPicker}
                              className="dossier-tag dossier-tag-add"
                            >
                              + {t.crmCustomerProfiles.ui.quickEdit.attach_tag}
                            </Button>
                          )}
                        </div>
                        {editable &&
                          canReadTags &&
                          isTagPickerOpen &&
                          availableTags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
                            {availableTags.map((tag) => (
                              <Button
                                key={tag.id}
                                type="button"
                                onClick={() => void handleAttachTag(tag)}
                                className="dossier-tag dossier-tag-indigo"
                              >
                                + {tag.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Account Details Edit Mode */
                  <div className="dossier-grid-2">
                    <div className="dossier-field-box">
                      <label
                        className="dossier-field-label"
                        htmlFor="qual-owner"
                      >
                        Salesperson (Owner)
                      </label>
                      <select
                        id="qual-owner"
                        className="dossier-select"
                        value={ownerUserIdDraft}
                        onChange={(e) => setOwnerUserIdDraft(e.target.value)}
                      >
                        <option value="">{ownerDisplayName}</option>
                        {ownerOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {leadDetailsUserName(u)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dossier-field-box">
                      <label
                        className="dossier-field-label"
                        htmlFor="qual-source"
                      >
                        Acquisition Source
                      </label>
                      <select
                        id="qual-source"
                        className="dossier-select"
                        value={sourceIdDraft}
                        onChange={(e) => setSourceIdDraft(e.target.value)}
                      >
                        <option value="">
                          {t.crmCustomerProfiles.ui.quickEdit.no_source}
                        </option>
                        {sources.map((src) => (
                          <option key={src.id} value={src.id}>
                            {localizedValue(src.nameAr, src.nameEn, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dossier-field-box dossier-span-all">
                      <label
                        className="dossier-field-label"
                        htmlFor="qual-description"
                      >
                        Description / Internal Notes
                      </label>
                      <input
                        id="qual-description"
                        className="dossier-input"
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Custom Fields Section */}
                {customFieldEntries.length > 0 && (
                  <div className="dossier-custom-fields-section">
                    <div className="dossier-custom-fields-head">
                      <span>✨ Custom Fields (Tenant Customer Schema)</span>
                      <span className="dossier-badge dossier-badge-individual">
                        Dynamic Custom Fields
                      </span>
                    </div>
                    <div className="dossier-grid-3">
                      {customFieldEntries.map(
                        ({ definition, value }) => {
                          const label = localizedValue(
                            definition.nameAr,
                            definition.nameEn,
                            lang,
                          );
                          const displayVal =
                            value?.value !== null && value?.value !== undefined
                              ? String(value.value)
                              : "—";
                          return (
                            <div
                              key={definition.id}
                              className="dossier-field-box"
                            >
                              <div className="dossier-field-label">{label}</div>
                              {isEditingQualification ? (
                                <input
                                  className="dossier-input"
                                  value={String(
                                    customFieldsDraft[definition.fieldKey] ??
                                      value?.value ??
                                      "",
                                  )}
                                  onChange={(e) =>
                                    setCustomFieldsDraft((prev) => ({
                                      ...prev,
                                      [definition.fieldKey]: e.target.value,
                                    }))
                                  }
                                />
                              ) : (
                                <div className="dossier-field-val">
                                  {displayVal}
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------------- RIGHT COLUMN (5/12) ---------------- */}
          <div className="dossier-col">
            {/* CORPORATE ONLY: CONTACT PERSONS CARD */}
            {isCorporate && (
              <div
                className={
                  editingContactDraft
                    ? DOSSIER_CARD_TONE_CLASSES.cyan.cardEditing
                    : DOSSIER_CARD_TONE_CLASSES.cyan.card
                }
              >
                <div className="dossier-card-head">
                  <div className="dossier-card-title">
                    <span className="dossier-card-icon">👥</span>
                    <span>
                      {editingContactDraft
                        ? editingContactDraft.partyId
                          ? formatTemplate(
                              t.crmCustomerProfiles.ui.quickEdit.editing_contact_person,
                              {
                                editingContactDraft_firstName:
                                  editingContactDraft.firstName,
                              },
                            )
                          : t.crmCustomerProfiles.ui.quickEdit.adding_contact_person
                        : `${t.crmCustomerProfiles.ui.quickEdit.contact_persons} (${fallbackDetail.contacts.length})`}
                    </span>
                  </div>
                  {editingContactDraft ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => setEditingContactDraft(null)}
                        className="dossier-edit-btn dossier-cancel-btn"
                      >
                        ✕ {t.crmCustomerProfiles.ui.quickEdit.cancel}
                      </Button>
                      <Button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => void saveContactPerson()}
                        className="dossier-edit-btn dossier-save-btn"
                      >
                        ✓ {t.crmCustomerProfiles.ui.quickEdit.save_contact}
                      </Button>
                    </div>
                  ) : (
                    editable && (
                      <Button
                        type="button"
                        onClick={() =>
                          setEditingContactDraft({
                            partyId: null,
                            honorificTitle: "",
                            firstName: "",
                            lastName: "",
                            jobTitle: "",
                            email: "",
                            phones: [""],
                            isPrimary: fallbackDetail.contacts.length === 0,
                          })
                        }
                        className="dossier-edit-btn"
                      >
                        + {t.crmCustomerProfiles.ui.quickEdit.add_contact_person}
                      </Button>
                    )
                  )}
                </div>

                <div className="dossier-card-body">
                  {editingContactDraft && (
                    <div className="dossier-phone-box-edit">
                      {editingContactDraft.partyId !== null && (
                        <p className="text-sm text-muted-foreground">
                          {t.crmCustomerProfiles.existingContactReadOnly}
                        </p>
                      )}
                      <div className="dossier-grid-3">
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ct-honorific"
                          >
                            Honorific Title
                          </label>
                          <select
                            id="ct-honorific"
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            className="dossier-select"
                            value={
                              findHonorific(
                                editingContactDraft.honorificTitle,
                                lang,
                              )?.label ?? editingContactDraft.honorificTitle
                            }
                            onChange={(e) =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      honorificTitle: e.target.value,
                                    }
                                  : prev,
                              )
                            }
                          >
                            <option value="">
                              {t.crmCustomerProfiles.ui.quickEdit.none}
                            </option>
                            {getHonorificOptions(lang).map((opt) => (
                              <option key={opt.key} value={opt.label}>
                                {opt.label}
                              </option>
                            ))}
                            {editingContactDraft.honorificTitle &&
                              !findHonorific(
                                editingContactDraft.honorificTitle,
                                lang,
                              ) && (
                                <option
                                  value={editingContactDraft.honorificTitle}
                                >
                                  {editingContactDraft.honorificTitle}
                                </option>
                              )}
                          </select>
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ct-first-name"
                          >
                            First Name *
                          </label>
                          <input
                            id="ct-first-name"
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            className="dossier-input"
                            value={editingContactDraft.firstName}
                            onChange={(e) =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? { ...prev, firstName: e.target.value }
                                  : prev,
                              )
                            }
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ct-last-name"
                          >
                            Last Name
                          </label>
                          <input
                            id="ct-last-name"
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            className="dossier-input"
                            value={editingContactDraft.lastName}
                            onChange={(e) =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? { ...prev, lastName: e.target.value }
                                  : prev,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="dossier-grid-2">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Job Title</div>
                          <CrmJobTitleField
                            value={editingContactDraft.jobTitle}
                            disabled={isSavingSection}
                            onChange={(next) =>
                              setEditingContactDraft((prev) =>
                                prev ? { ...prev, jobTitle: next } : prev,
                              )
                            }
                            onBlur={() => {}}
                          />
                        </div>
                        <div className="dossier-field-box">
                          <label
                            className="dossier-field-label"
                            htmlFor="ct-email"
                          >
                            Contact Email
                          </label>
                          <input
                            id="ct-email"
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            className="dossier-input"
                            value={editingContactDraft.email}
                            onChange={(e) =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? { ...prev, email: e.target.value }
                                  : prev,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="dossier-phone-box-head mt-1">
                        <span className="dossier-phone-box-label">
                          📱 Contact Mobile Numbers (Split Code + Number)
                        </span>
                        <Button
                          type="button"
                          onClick={() =>
                            setEditingContactDraft((prev) =>
                              prev
                                ? { ...prev, phones: [...prev.phones, ""] }
                                : prev,
                            )
                          }
                          disabled={editingContactDraft.partyId !== null || isSavingSection}
                          className="dossier-add-phone-btn"
                        >
                          + Add Number
                        </Button>
                      </div>

                      {editingContactDraft.phones.map((ph, idx) => (
                        <div key={idx} className="dossier-phone-split-row">
                          <CrmPhoneNumberInput
                            value={ph}
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            maxLength={32}
                            label={`Contact Mobile ${idx + 1}`}
                            placeholder="1229988776"
                            onChange={(next) =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      phones: prev.phones.map((entry, i) =>
                                        i === idx ? next : entry,
                                      ),
                                    }
                                  : prev,
                              )
                            }
                            onBlur={() => {}}
                          />
                          <Button
                            type="button"
                            aria-label={`Remove contact phone ${idx + 1}`}
                            disabled={editingContactDraft.partyId !== null || isSavingSection}
                            onClick={() =>
                              setEditingContactDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      phones:
                                        prev.phones.length === 1
                                          ? [""]
                                          : prev.phones.filter(
                                              (_, i) => i !== idx,
                                            ),
                                    }
                                  : prev,
                              )
                            }
                            className="dossier-del-btn"
                          >
                            <Trash2
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contact Cards List */}
                  {fallbackDetail.contacts.length > 0 ? (
                    fallbackDetail.contacts
                      .filter(
                        (ct) =>
                          !editingContactDraft ||
                          ct.partyId !== editingContactDraft.partyId,
                      )
                      .map((ct) => (
                        <div
                          key={ct.partyId}
                          className={cn(
                            "dossier-contact-card",
                            ct.isPrimary && "primary",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="dossier-contact-avatar">
                                {getInitials(ct.displayName)}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="dossier-contact-name">
                                    {ct.honorificTitle
                                      ? `${ct.honorificTitle} ${ct.displayName}`
                                      : ct.displayName}
                                  </span>
                                  {ct.isPrimary && (
                                    <span className="dossier-badge dossier-badge-stage">
                                      ★ Primary Contact
                                    </span>
                                  )}
                                </div>
                                <div className="dossier-contact-role">
                                  {[
                                    ct.jobTitle,
                                    ct.email ? `✉️ ${ct.email}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </div>
                              </div>
                            </div>

                            {editable && (
                              <div className="flex items-center gap-1.5">
                                {!ct.isPrimary && (
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      void handleSetPrimaryContact(ct.partyId)
                                    }
                                    className="dossier-edit-btn"
                                  >
                                    ★ Set Primary
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  onClick={() =>
                                    setEditingContactDraft({
                                      partyId: ct.partyId,
                                      honorificTitle: ct.honorificTitle ?? "",
                                      firstName:
                                        ct.firstName ??
                                        ct.displayName.split(" ")[0] ??
                                        "",
                                      lastName:
                                        ct.lastName ??
                                        ct.displayName
                                          .split(" ")
                                          .slice(1)
                                          .join(" ") ??
                                        "",
                                      jobTitle: ct.jobTitle ?? "",
                                      email: ct.email ?? "",
                                      phones:
                                        ct.phones.length > 0
                                          ? [...ct.phones]
                                          : [""],
                                      isPrimary: ct.isPrimary,
                                    })
                                  }
                                  className="dossier-edit-btn"
                                >
                                  ✏️ Edit
                                </Button>
                              </div>
                            )}
                          </div>

                          {ct.phones.map((ph, idx) => (
                            <div
                              key={`${ph}-${idx}`}
                              className="dossier-phone-item-view"
                            >
                              <span className="dossier-phone-num" dir="ltr">
                                📱 {formatPhoneDisplay(ph)}
                              </span>
                              <PhoneActionPills
                                phone={ph}
                                country={
                                  fallbackDetail.address?.country ??
                                  item.country
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-primary/30 p-3 text-center text-xs text-muted-foreground">
                      {t.crmCustomerProfiles.ui.quickEdit.no_contact_persons_recorded_for_this_company}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DOSSIER PANEL CARD: 4 INTERACTIVE TABS (Activities, Notes, Audit Log, Files) */}
            <div
              className={
                activeDossierTab === "notes"
                  ? DOSSIER_CARD_TONE_CLASSES.emerald.card
                  : DOSSIER_CARD_TONE_CLASSES.amber.card
              }
            >
              <div className="dossier-card-head">
                <div className="dossier-tabs" role="tablist">
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === "activities"}
                    onClick={() => setActiveDossierTab("activities")}
                    className={cn(
                      "dossier-tab",
                      activeDossierTab === "activities" && "active",
                    )}
                  >
                    📅 {t.crmCustomerProfiles.ui.quickEdit.activities} (
                    {item.nextActivity ? 1 : 0})
                  </Button>
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === "notes"}
                    onClick={() => setActiveDossierTab("notes")}
                    className={cn(
                      "dossier-tab",
                      activeDossierTab === "notes" && "active",
                    )}
                  >
                    📝 {t.crmCustomerProfiles.ui.quickEdit.notes}
                  </Button>
                  {canReadHistory && <Button
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === "history"}
                    onClick={() => setActiveDossierTab("history")}
                    className={cn(
                      "dossier-tab",
                      activeDossierTab === "history" && "active",
                    )}
                  >
                    {t.audit.historyTitle}
                  </Button>}
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === "files"}
                    onClick={() => setActiveDossierTab("files")}
                    className={cn(
                      "dossier-tab",
                      activeDossierTab === "files" && "active",
                    )}
                  >
                    📎 {t.crmCustomerProfiles.ui.quickEdit.files}
                  </Button>
                </div>

                {activeDossierTab === "activities" && onOpenActivities && (
                  <Button
                    type="button"
                    onClick={() => onOpenActivities(item)}
                    className="dossier-edit-btn"
                  >
                    + {t.crmCustomerProfiles.ui.quickEdit.book_activity}
                  </Button>
                )}
              </div>

              <div className="dossier-card-body">
                {activeDossierTab === "activities" && (
                  <div className="flex flex-col gap-3">
                    {item.nextActivity ? (
                      <div className="dossier-activity-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="dossier-activity-title">
                            📞{" "}
                            {t.crmCustomerProfiles.ui.quickEdit.next_scheduled_follow_up}
                          </span>
                          <span
                            className={cn(
                              "dossier-badge",
                              activityState === "OVERDUE"
                                ? "border-destructive bg-destructive-subtle text-destructive-subtle-foreground"
                                : "dossier-badge-stage",
                            )}
                          >
                            {activityState === "OVERDUE"
                              ? "OVERDUE"
                              : "SCHEDULED"}{" "}
                            •{" "}
                            {new Date(
                              item.nextActivity.activityAt,
                            ).toLocaleDateString(lang, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="dossier-activity-meta">
                          Status: {item.nextActivity.bucket} • Assigned to:{" "}
                          {ownerDisplayName}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-warning p-4 text-center">
                        <p className="text-xs font-semibold text-foreground">
                          {t.crmCustomerProfiles.ui.quickEdit.no_scheduled_activities}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.crmCustomerProfiles.ui.quickEdit.book_activity_hint}
                        </p>
                      </div>
                    )}

                    {isUUIDv7(fallbackDetail.id) && (
                      <RecordActivitiesPanel
                        target={{
                          app: "CRM",
                          type: "CUSTOMER_PROFILE",
                          id: fallbackDetail.id,
                          label: fallbackDetail.displayName,
                        }}
                        readOnly={!editable}
                      />
                    )}
                  </div>
                )}

                {activeDossierTab === "notes" && (
                  <RecordNotesSection
                    branchId={effectiveBranchId}
                    sourceType="CUSTOMER_PROFILE"
                    sourceId={fallbackDetail.id}
                    sourceOwnerUserId={fallbackDetail.ownerUserId}
                    createCapability={attached.capabilities.notesCreate}
                    readOnly={!canMutate || fallbackDetail.status === "BLACKLISTED"}
                  />
                )}

                {activeDossierTab === "history" && (
                  <RecordHistoryTab
                    density="compact"
                    entityType="CustomerProfile"
                    entityId={fallbackDetail.id}
                    relatedPartyIds={[
                      fallbackDetail.partyId,
                      ...fallbackDetail.contacts.map((c) => c.partyId),
                    ]}
                    refreshToken={fallbackDetail}
                  />
                )}

                {activeDossierTab === "files" && (
                  <RecordAttachmentsSection
                    branchId={effectiveBranchId}
                    sourceType="CUSTOMER_PROFILE"
                    sourceId={fallbackDetail.id}
                    sourceOwnerUserId={fallbackDetail.ownerUserId}
                    createCapability={attached.capabilities.attachmentsCreate}
                    deleteCapability={attached.capabilities.attachmentsDelete}
                    readOnly={!editable}
                    uploadVariant="button"
                    density="compact"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 5. BOTTOM MODAL FOOTER ================= */}
        <div className="dossier-footer">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>
              Navigate Customers (
              {currentIndex >= 0 ? currentIndex + 1 : 1} of{" "}
              {Math.max(allItems.length, 1)}):
            </span>
            <Button
              type="button"
              disabled={!prevCustomer || !onSelectCustomer}
              onClick={() => prevCustomer && onSelectCustomer?.(prevCustomer)}
              className="dossier-btn dossier-btn-outline disabled:opacity-40"
            >
              ← Prev Customer [J]
            </Button>
            <Button
              type="button"
              disabled={!nextCustomer || !onSelectCustomer}
              onClick={() => nextCustomer && onSelectCustomer?.(nextCustomer)}
              className="dossier-btn dossier-btn-outline disabled:opacity-40"
            >
              Next Customer [K] →
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {deletable && onDelete && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(item);
                }}
                className="dossier-btn dossier-btn-danger"
              >
                🗑️ {t.crmCustomerProfiles.ui.quickEdit.delete_customer}
              </Button>
            )}
            <Button
              type="button"
              onClick={onClose}
              className="dossier-btn dossier-btn-outline"
            >
              {t.crmCustomerProfiles.ui.quickEdit.close_esc}
            </Button>
            <Button
              type="button"
              disabled={!editable || isSavingSection}
              onClick={() => void handleSaveAndClose()}
              className="dossier-btn dossier-btn-primary"
            >
              ✓ {t.crmCustomerProfiles.ui.quickEdit.save_close_ctrl_s}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
