"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  DOSSIER_CARD_TONE_CLASSES,
  DOSSIER_HEADER_CARD_COLORS,
  DOSSIER_KPI_PILL_CLASSES,
  DOSSIER_TAG_TONE_CLASSES,
  type CardColor,
  cn,
  dossierAvatarClass,
  dossierStageCellClass,
  dossierStatusBadgeClass,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { splitPhoneNumber } from "@/lib/geo/country-data";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { CrmJobTitleField } from "../../shared/components/CrmJobTitleField";
import { CrmPhoneNumberInput } from "../../shared/components/CrmPhoneNumberInput";
import { RecordAttachmentsSection } from "../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../shared/components/RecordNotesSection";
import { crmCapabilityAllowsOwner } from "../../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmCustomFieldValues } from "../../shared/hooks/useCrmCustomFieldValues";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../shared/tag-contract";
import { LeadConvertModal } from "../[id]/components/LeadConvertModal";
import { useLeadConvert } from "../[id]/hooks/useLeadConvert";
import { useLeadDetailsReferences } from "../[id]/hooks/useLeadDetailsReferences";
import { useLeadRelatedCounts } from "../[id]/hooks/useLeadRelatedCounts";
import { leadDetailsUserName } from "../[id]/lead-details-edit-contract";
import { LEAD_RELATED_ROUTES } from "../[id]/lead-related-contract";
import { useLeadCapabilities } from "../hooks/useLeadCapabilities";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { leadActivityState } from "../lead-card-contract";
import {
  leadPath,
  parseLeadDetailResponse,
  type LeadContact,
  type LeadDetail,
} from "../lead-contract";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../lead-phone-links";
import {
  buildLeadCompanyFieldRequest,
  buildLeadCompanyPhonesRequest,
  type UpdateLeadRequest,
} from "../lead-write-contract";

export interface LeadQuickEditModalProps {
  lead: LeadItem | null;
  leads: readonly LeadItem[];
  stages: readonly LeadStage[];
  branchId?: string | null;
  canUpdate: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onNavigateLead: (nextLead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => Promise<void>;
  onOpenActivities: (lead: LeadItem) => void;
  onSave: (lead: LeadItem, request: UpdateLeadRequest) => Promise<boolean>;
  onDeleteLead?: (lead: LeadItem) => void;
  onRefresh?: () => void;
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
  if (parts.length === 0) return "LD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function synthesizeLeadDetail(lead: LeadItem, branchId: string | null, stages: readonly LeadStage[]): LeadDetail {
  const stage = stages.find((st) => st.id === lead.stageId);
  const stageFlag = stage?.flag ?? "NEW";
  const status =
    stageFlag === "CONVERTED"
      ? "CONVERTED"
      : stageFlag === "DISQUALIFIED"
        ? "DISQUALIFIED"
        : stageFlag === "ON_HOLD"
          ? "ON_HOLD"
          : "OPEN";

  const isCorporate = lead.leadProfileType === "CORPORATE";
  const initialPhones =
    lead.phones.length > 0
      ? [...lead.phones]
      : lead.phone
        ? [lead.phone]
        : [];

  const synthesizedContacts: LeadContact[] =
    isCorporate && lead.primaryContact
      ? [
          {
            partyId: lead.primaryContact.partyId,
            relationshipId: null,
            displayName: lead.primaryContact.displayName,
            firstName: lead.primaryContact.displayName.split(" ")[0] ?? null,
            lastName: lead.primaryContact.displayName.split(" ").slice(1).join(" ") || null,
            honorificTitle: null,
            jobTitle: lead.primaryContact.jobTitle || null,
            isPrimary: true,
            email: lead.primaryContact.email || null,
            phones:
              lead.primaryContact.phones.length > 0
                ? [...lead.primaryContact.phones]
                : lead.phone
                  ? [lead.phone]
                  : [],
          },
        ]
      : [];

  return {
    id: lead.id,
    branchId: branchId ?? "",
    partyId: lead.partyId,
    leadProfileType: lead.leadProfileType,
    stageId: lead.stageId,
    stageFlag,
    status,
    displayName: lead.leadName,
    firstName: lead.firstName ?? (isCorporate ? null : lead.leadName.split(" ")[0] ?? null),
    lastName:
      lead.lastName ??
      (isCorporate ? null : lead.leadName.split(" ").slice(1).join(" ") || null),
    honorificTitle: null,
    companyName: isCorporate ? lead.company || lead.leadName : null,
    primaryMobile: lead.primaryMobile ?? (isCorporate ? null : initialPhones[0] ?? null),
    email: lead.email || null,
    companyPhone: isCorporate ? initialPhones[0] ?? null : null,
    companyEmail: isCorporate ? lead.email || null : null,
    companyWebsite: lead.companyWebsite ?? null,
    taxNumber: lead.taxNumber ?? null,
    commercialRegistrationNumber: lead.commercialRegistrationNumber ?? null,
    phones: initialPhones,
    address:
      lead.country || lead.city
        ? {
            addressType: isCorporate ? "HEADQUARTERS" : "HOME",
            label: null,
            country: lead.country || null,
            city: lead.city ?? null,
            area: null,
            street: null,
            buildingNo: null,
            floor: null,
            apartment: null,
            landmark: null,
            postalCode: null,
          }
        : null,
    contacts: synthesizedContacts,
    acquisitionSourceId: lead.acquisitionSourceId ?? null,
    acquisitionSourceNameAr: lead.sourceNameAr || null,
    acquisitionSourceNameEn: lead.sourceNameEn || null,
    description: lead.description ?? null,
    interestSummary: lead.interestSummary ?? null,
    expectedNeed: lead.expectedNeed ?? null,
    ownerUserId: lead.ownerUserId,
    createdByUserId: lead.ownerUserId,
    convertedCustomerProfileId: null,
    convertedOpportunityId: null,
    convertedAt: null,
    createdAt: lead.createdAt ?? new Date().toISOString(),
    updatedAt: lead.updatedAt ?? new Date().toISOString(),
  };
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

function formatFullAddress(address: LeadDetail["address"]): string {
  if (!address) return "—";
  const parts = [
    address.buildingNo ? `Bldg ${address.buildingNo}` : null,
    address.street,
    address.floor ? `Floor ${address.floor}` : null,
    address.apartment ? `Apt ${address.apartment}` : null,
    address.area,
    address.city,
    address.country,
    address.postalCode ? `(${address.postalCode})` : null,
    address.landmark ? `— ${address.landmark}` : null,
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
 * across all 8 verified states (Corporate View/Edit/Contacts, Individual View/Edit,
 * Converted Locked State, and Light/Dark Modes).
 */
export function LeadQuickEditModal({
  lead,
  leads,
  stages,
  branchId = null,
  canUpdate,
  canDelete = false,
  onClose,
  onNavigateLead,
  onMoveStage,
  onOpenActivities,
  onSave,
  onDeleteLead,
  onRefresh,
}: LeadQuickEditModalProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const router = useRouter();
  const { canMutate } = useAccessMode();
  const { items: sources } = useCrmAcquisitionSources();

  // Synchronously synthesize detail from `lead` so frame 1 and unit tests have zero flicker,
  // then hydrate full `GET /api/tenant/crm/v1/leads/:id` when `lead.id` is a valid UUIDv7.
  const [detail, setDetail] = useState<LeadDetail | null>(() =>
    lead ? synthesizeLeadDetail(lead, branchId, stages) : null,
  );
  const [localRating, setLocalRating] = useState<number>(lead?.rating ?? 0);
  const [localCardColor, setLocalCardColor] = useState<CardColor | null>(lead?.cardColor ?? null);
  const [localTags, setLocalTags] = useState<CrmTag[]>(lead?.tags ?? []);

  // Section-level edit mode flags (View Mode by default — zero "Click any field to edit in-place")
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [isEditingQualification, setIsEditingQualification] = useState(false);
  const [editingContactDraft, setEditingContactDraft] = useState<ContactDraft | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTab>("activities");
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Tag picker state
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);

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

  // Structured Address draft state
  const [addressTypeDraft, setAddressTypeDraft] = useState("HEADQUARTERS");
  const [countryDraft, setCountryDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [areaDraft, setAreaDraft] = useState("");
  const [postalCodeDraft, setPostalCodeDraft] = useState("");
  const [streetDraft, setStreetDraft] = useState("");
  const [buildingNoDraft, setBuildingNoDraft] = useState("");
  const [floorDraft, setFloorDraft] = useState("");
  const [apartmentDraft, setApartmentDraft] = useState("");
  const [landmarkDraft, setLandmarkDraft] = useState("");

  // Card 2 draft state (Qualification, Ownership & Custom Fields)
  const [ownerUserIdDraft, setOwnerUserIdDraft] = useState("");
  const [sourceIdDraft, setSourceIdDraft] = useState("");
  const [interestSummaryDraft, setInterestSummaryDraft] = useState("");
  const [expectedNeedDraft, setExpectedNeedDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [customFieldsDraft, setCustomFieldsDraft] = useState<Record<string, unknown>>({});

  const effectiveBranchId = detail?.branchId || branchId || null;
  const { capabilities } = useLeadCapabilities(effectiveBranchId);
  const relatedCounts = useLeadRelatedCounts(
    lead?.id ?? null,
    detail?.partyId ?? lead?.partyId ?? null,
    effectiveBranchId,
  );
  const customFieldValues = useCrmCustomFieldValues(
    effectiveBranchId,
    "LEAD",
    lead?.id ?? null,
  );

  // Sync synthesized state when `lead` prop changes
  useEffect(() => {
    if (!lead) {
      setDetail(null);
      return;
    }
    const seeded = synthesizeLeadDetail(lead, branchId, stages);
    setDetail(seeded);
    setLocalRating(lead.rating);
    setLocalCardColor(lead.cardColor);
    setLocalTags(lead.tags ?? []);
    setIsEditingIdentity(false);
    setIsEditingQualification(false);
    setEditingContactDraft(null);
    setSectionError(null);

    if (!isUUIDv7(lead.id)) return;
    const controller = new AbortController();
    void axiosClient
      .get<unknown>(leadPath(lead.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        const parsed = parseLeadDetailResponse(res.data);
        setDetail(parsed);
      })
      .catch(() => {
        // Keep synthesized detail when offline or mocked
      });
    return () => controller.abort();
  }, [lead, branchId, stages]);

  const reloadDetail = useCallback(() => {
    if (!lead || !isUUIDv7(lead.id)) return;
    void axiosClient
      .get<unknown>(leadPath(lead.id), {
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        setDetail(parseLeadDetailResponse(res.data));
      })
      .catch(() => {});
    onRefresh?.();
  }, [lead, onRefresh]);

  const isConverted =
    detail?.status === "CONVERTED" ||
    detail?.stageFlag === "CONVERTED" ||
    Boolean(detail?.convertedCustomerProfileId);
  const editable = canUpdate && !isConverted;

  const canConvert =
    canMutate &&
    detail !== null &&
    !isConverted &&
    (crmCapabilityAllowsOwner(capabilities.convert, detail.ownerUserId) || canUpdate);

  const convertState = useLeadConvert(
    detail,
    reloadDetail,
    canConvert,
    capabilities.opportunitiesCreate ?? null,
  );

  const fallbackDetail = useMemo(
    () => (lead ? detail ?? synthesizeLeadDetail(lead, branchId, stages) : null),
    [lead, detail, branchId, stages],
  );

  const references = useLeadDetailsReferences(
    fallbackDetail ?? {
      id: "",
      branchId: "",
      partyId: "",
      leadProfileType: "CORPORATE",
      stageId: "",
      stageFlag: "NEW",
      status: "OPEN",
      displayName: "",
      firstName: null,
      lastName: null,
      honorificTitle: null,
      companyName: null,
      primaryMobile: null,
      email: null,
      companyPhone: null,
      companyEmail: null,
      companyWebsite: null,
      taxNumber: null,
      commercialRegistrationNumber: null,
      phones: [],
      address: null,
      contacts: [],
      acquisitionSourceId: null,
      acquisitionSourceNameAr: null,
      acquisitionSourceNameEn: null,
      description: null,
      interestSummary: null,
      expectedNeed: null,
      ownerUserId: null,
      createdByUserId: null,
      convertedCustomerProfileId: null,
      convertedOpportunityId: null,
      convertedAt: null,
      createdAt: "",
      updatedAt: "",
    },
    isEditingQualification,
    capabilities.update?.ownerUserIds ?? null,
  );

  useEffect(() => {
    if (references.tags.length > 0) {
      setLocalTags(references.tags);
    }
  }, [references.tags]);

  const currentIndex = lead ? leads.findIndex((item) => item.id === lead.id) : -1;
  const prevLead = currentIndex > 0 ? leads[currentIndex - 1] : null;
  const nextLead =
    currentIndex >= 0 && currentIndex < leads.length - 1 ? leads[currentIndex + 1] : null;

  // Populate Card 1 drafts when entering Identity/Company Edit Mode
  const startIdentityEdit = useCallback(() => {
    if (!fallbackDetail || !editable) return;
    setSectionError(null);
    const isCorp = fallbackDetail.leadProfileType === "CORPORATE";
    setCompanyNameDraft(fallbackDetail.companyName || fallbackDetail.displayName || "");
    setCompanyEmailDraft(fallbackDetail.companyEmail || fallbackDetail.email || "");
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

    setHonorificDraft(fallbackDetail.honorificTitle ?? "");
    setFirstNameDraft(fallbackDetail.firstName ?? fallbackDetail.displayName.split(" ")[0] ?? "");
    setLastNameDraft(
      fallbackDetail.lastName ?? fallbackDetail.displayName.split(" ").slice(1).join(" ") ?? "",
    );
    setDisplayNameDraft(fallbackDetail.displayName || "");
    setPersonalEmailDraft(fallbackDetail.email ?? "");

    setAddressTypeDraft(
      fallbackDetail.address?.addressType || (isCorp ? "HEADQUARTERS" : "HOME"),
    );
    setCountryDraft(fallbackDetail.address?.country ?? lead?.country ?? "");
    setCityDraft(fallbackDetail.address?.city ?? lead?.city ?? "");
    setAreaDraft(fallbackDetail.address?.area ?? "");
    setPostalCodeDraft(fallbackDetail.address?.postalCode ?? "");
    setStreetDraft(fallbackDetail.address?.street ?? "");
    setBuildingNoDraft(fallbackDetail.address?.buildingNo ?? "");
    setFloorDraft(fallbackDetail.address?.floor ?? "");
    setApartmentDraft(fallbackDetail.address?.apartment ?? "");
    setLandmarkDraft(fallbackDetail.address?.landmark ?? "");
    setIsEditingIdentity(true);
  }, [fallbackDetail, editable, lead]);

  // Populate Card 2 drafts when entering Qualification Edit Mode
  const startQualificationEdit = useCallback(() => {
    if (!fallbackDetail || !editable) return;
    setSectionError(null);
    setOwnerUserIdDraft(fallbackDetail.ownerUserId ?? "");
    setSourceIdDraft(fallbackDetail.acquisitionSourceId ?? "");
    setInterestSummaryDraft(fallbackDetail.interestSummary ?? "");
    setExpectedNeedDraft(fallbackDetail.expectedNeed ?? "");
    setDescriptionDraft(fallbackDetail.description ?? "");
    const cfMap: Record<string, unknown> = {};
    for (const entry of customFieldValues.entries) {
      cfMap[entry.definition.fieldKey] = entry.value?.value ?? "";
    }
    setCustomFieldsDraft(cfMap);
    setIsEditingQualification(true);
  }, [fallbackDetail, editable, customFieldValues.entries]);

  // Save Card 1 (Corporate Company Details OR Individual Personal Info)
  const saveIdentitySection = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const isCorp = fallbackDetail.leadProfileType === "CORPORATE";
    const patch: UpdateLeadRequest = {};

    if (isCorp) {
      if (!companyNameDraft.trim()) {
        setSectionError(isAr ? "اسم الشركة مطلوب" : "Company Name is required.");
        return false;
      }
      if (companyNameDraft.trim() !== (fallbackDetail.companyName ?? "")) {
        Object.assign(patch, buildLeadCompanyFieldRequest("companyName", companyNameDraft));
      }
      if (companyEmailDraft.trim() !== (fallbackDetail.companyEmail ?? "")) {
        Object.assign(patch, buildLeadCompanyFieldRequest("companyEmail", companyEmailDraft));
      }
      if (taxNumberDraft.trim() !== (fallbackDetail.taxNumber ?? "")) {
        Object.assign(patch, buildLeadCompanyFieldRequest("taxNumber", taxNumberDraft));
      }
      if (crNumberDraft.trim() !== (fallbackDetail.commercialRegistrationNumber ?? "")) {
        Object.assign(
          patch,
          buildLeadCompanyFieldRequest("commercialRegistrationNumber", crNumberDraft),
        );
      }
      if (websiteDraft.trim() !== (fallbackDetail.companyWebsite ?? "")) {
        Object.assign(patch, buildLeadCompanyFieldRequest("companyWebsite", websiteDraft));
      }
      const cleanedPhones = phonesDraft.map((p) => p.trim()).filter(Boolean);
      if (JSON.stringify(cleanedPhones) !== JSON.stringify(fallbackDetail.phones)) {
        Object.assign(patch, buildLeadCompanyPhonesRequest(cleanedPhones));
      }
    } else {
      const nextDisplay =
        displayNameDraft.trim() ||
        [firstNameDraft.trim(), lastNameDraft.trim()].filter(Boolean).join(" ");
      if (!nextDisplay) {
        setSectionError(isAr ? "اسم العميل مطلوب" : "First Name / Display Name is required.");
        return false;
      }
      if (nextDisplay !== fallbackDetail.displayName) patch.displayName = nextDisplay;
      if (firstNameDraft.trim() !== (fallbackDetail.firstName ?? "")) {
        patch.firstName = firstNameDraft.trim();
      }
      if (lastNameDraft.trim() !== (fallbackDetail.lastName ?? "")) {
        patch.lastName = lastNameDraft.trim();
      }
      if (honorificDraft.trim() !== (fallbackDetail.honorificTitle ?? "")) {
        patch.honorificTitle = honorificDraft.trim() || null;
      }
      if (personalEmailDraft.trim() !== (fallbackDetail.email ?? "")) {
        patch.email = personalEmailDraft.trim() || null;
      }
      const cleanedPhones = phonesDraft.map((p) => p.trim()).filter(Boolean);
      if (JSON.stringify(cleanedPhones) !== JSON.stringify(fallbackDetail.phones)) {
        patch.phones = cleanedPhones;
      }
    }

    // Check if structured address changed
    const hasAddressInput = Boolean(
      countryDraft.trim() ||
        cityDraft.trim() ||
        areaDraft.trim() ||
        streetDraft.trim() ||
        buildingNoDraft.trim() ||
        postalCodeDraft.trim() ||
        landmarkDraft.trim(),
    );
    if (hasAddressInput) {
      patch.address = {
        country: countryDraft.trim() || undefined,
        city: cityDraft.trim() || undefined,
        state: areaDraft.trim() || undefined,
        postalCode: postalCodeDraft.trim() || undefined,
        street1: streetDraft.trim() || undefined,
        buildingNo: buildingNoDraft.trim() || undefined,
        floor: floorDraft.trim() || undefined,
        apartment: apartmentDraft.trim() || undefined,
        landmark: landmarkDraft.trim() || undefined,
      };
    }

    setIsSavingSection(true);
    try {
      const cleanedPhones = phonesDraft.map((p) => p.trim()).filter(Boolean);
      if (Object.keys(patch).length > 0) {
        const ok = await onSave(lead, patch);
        if (!ok) return false;
      }
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          companyName: isCorp ? companyNameDraft.trim() : prev.companyName,
          displayName: isCorp
            ? companyNameDraft.trim()
            : displayNameDraft.trim() ||
              [firstNameDraft.trim(), lastNameDraft.trim()].filter(Boolean).join(" ") ||
              prev.displayName,
          firstName: isCorp ? prev.firstName : firstNameDraft.trim() || null,
          lastName: isCorp ? prev.lastName : lastNameDraft.trim() || null,
          honorificTitle: isCorp ? prev.honorificTitle : honorificDraft.trim() || null,
          email: isCorp ? prev.email : personalEmailDraft.trim() || null,
          companyEmail: isCorp ? companyEmailDraft.trim() || null : prev.companyEmail,
          taxNumber: isCorp ? taxNumberDraft.trim() || null : prev.taxNumber,
          commercialRegistrationNumber: isCorp
            ? crNumberDraft.trim() || null
            : prev.commercialRegistrationNumber,
          companyWebsite: isCorp ? websiteDraft.trim() || null : prev.companyWebsite,
          phones: cleanedPhones,
          companyPhone: isCorp ? cleanedPhones[0] ?? null : prev.companyPhone,
          primaryMobile: isCorp ? prev.primaryMobile : cleanedPhones[0] ?? null,
          address: hasAddressInput
            ? {
                addressType: addressTypeDraft || (isCorp ? "HEADQUARTERS" : "HOME"),
                label: prev.address?.label ?? null,
                country: countryDraft.trim() || null,
                city: cityDraft.trim() || null,
                area: areaDraft.trim() || null,
                postalCode: postalCodeDraft.trim() || null,
                street: streetDraft.trim() || null,
                buildingNo: buildingNoDraft.trim() || null,
                floor: floorDraft.trim() || null,
                apartment: apartmentDraft.trim() || null,
                landmark: landmarkDraft.trim() || null,
              }
            : prev.address,
        };
      });
      setIsEditingIdentity(false);
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [
    lead,
    fallbackDetail,
    editable,
    isAr,
    companyNameDraft,
    companyEmailDraft,
    taxNumberDraft,
    crNumberDraft,
    websiteDraft,
    phonesDraft,
    displayNameDraft,
    firstNameDraft,
    lastNameDraft,
    honorificDraft,
    personalEmailDraft,
    addressTypeDraft,
    countryDraft,
    cityDraft,
    areaDraft,
    postalCodeDraft,
    streetDraft,
    buildingNoDraft,
    floorDraft,
    apartmentDraft,
    landmarkDraft,
    onSave,
  ]);

  // Save Card 2 (Qualification, Ownership & Custom Fields)
  const saveQualificationSection = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const patch: UpdateLeadRequest = {};
    if (ownerUserIdDraft !== (fallbackDetail.ownerUserId ?? "")) {
      patch.ownerUserId = ownerUserIdDraft || null;
    }
    if (sourceIdDraft !== (fallbackDetail.acquisitionSourceId ?? "")) {
      patch.acquisitionSourceId = sourceIdDraft || null;
    }
    if (interestSummaryDraft.trim() !== (fallbackDetail.interestSummary ?? "")) {
      patch.interestSummary = interestSummaryDraft.trim();
    }
    if (expectedNeedDraft.trim() !== (fallbackDetail.expectedNeed ?? "")) {
      patch.expectedNeed = expectedNeedDraft.trim();
    }
    if (descriptionDraft.trim() !== (fallbackDetail.description ?? "")) {
      patch.description = descriptionDraft.trim();
    }
    if (Object.keys(customFieldsDraft).length > 0) {
      patch.customFields = customFieldsDraft;
    }

    setIsSavingSection(true);
    try {
      if (Object.keys(patch).length > 0) {
        const ok = await onSave(lead, patch);
        if (!ok) return false;
      }
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
              interestSummary: interestSummaryDraft.trim() || null,
              expectedNeed: expectedNeedDraft.trim() || null,
              description: descriptionDraft.trim() || null,
            }
          : prev,
      );
      setIsEditingQualification(false);
      if (Object.keys(customFieldsDraft).length > 0) {
        customFieldValues.reload();
      }
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [
    lead,
    fallbackDetail,
    editable,
    ownerUserIdDraft,
    sourceIdDraft,
    interestSummaryDraft,
    expectedNeedDraft,
    descriptionDraft,
    customFieldsDraft,
    onSave,
    sources,
    customFieldValues,
  ]);

  // Save Contact Person (Add or Edit in Corporate Contact Persons Card)
  const saveContactPerson = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editingContactDraft || !editable) return false;
    const trimmedFirst = editingContactDraft.firstName.trim();
    const trimmedLast = editingContactDraft.lastName.trim();
    const fullDisplayName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ");
    if (!fullDisplayName) {
      setSectionError(isAr ? "الاسم الأول لجهة الاتصال مطلوب" : "Contact first name is required.");
      return false;
    }

    const cleanedPhones = editingContactDraft.phones.map((p) => p.trim()).filter(Boolean);
    const currentContacts = fallbackDetail.contacts;
    const isAdding = editingContactDraft.partyId === null;
    const nextPartyId = editingContactDraft.partyId ?? generateUUIDv7();

    const updatedContactList: LeadContact[] = isAdding
      ? [
          ...currentContacts.map((c) =>
            editingContactDraft.isPrimary ? { ...c, isPrimary: false } : c,
          ),
          {
            partyId: nextPartyId,
            relationshipId: null,
            displayName: fullDisplayName,
            firstName: trimmedFirst || null,
            lastName: trimmedLast || null,
            honorificTitle: editingContactDraft.honorificTitle.trim() || null,
            jobTitle: editingContactDraft.jobTitle.trim() || null,
            email: editingContactDraft.email.trim() || null,
            phones: cleanedPhones,
            isPrimary: editingContactDraft.isPrimary || currentContacts.length === 0,
          },
        ]
      : currentContacts.map((c) => {
          if (c.partyId === editingContactDraft.partyId) {
            return {
              ...c,
              displayName: fullDisplayName,
              firstName: trimmedFirst || null,
              lastName: trimmedLast || null,
              honorificTitle: editingContactDraft.honorificTitle.trim() || null,
              jobTitle: editingContactDraft.jobTitle.trim() || null,
              email: editingContactDraft.email.trim() || null,
              phones: cleanedPhones,
              isPrimary: editingContactDraft.isPrimary,
            };
          }
          return editingContactDraft.isPrimary ? { ...c, isPrimary: false } : c;
        });

    const contactsPayload = updatedContactList.map((c) => ({
      ...(currentContacts.some((orig) => orig.partyId === c.partyId)
        ? { contactPartyId: c.partyId }
        : {}),
      fullName: c.displayName,
      firstName: c.firstName ?? c.displayName,
      lastName: c.lastName ?? undefined,
      honorificTitle: c.honorificTitle,
      jobTitle: c.jobTitle,
      email: c.email,
      phones: c.phones,
      isPrimary: c.isPrimary,
    }));

    setIsSavingSection(true);
    try {
      const ok = await onSave(lead, { contacts: contactsPayload });
      if (!ok) return false;
      setDetail((prev) => (prev ? { ...prev, contacts: updatedContactList } : prev));
      setEditingContactDraft(null);
      return true;
    } finally {
      setIsSavingSection(false);
    }
  }, [lead, fallbackDetail, editingContactDraft, editable, isAr, onSave]);

  // Promote a corporate contact to primary directly
  const handleSetPrimaryContact = useCallback(
    async (targetPartyId: string) => {
      if (!lead || !fallbackDetail || !editable) return;
      const updated = fallbackDetail.contacts.map((c) => ({
        ...c,
        isPrimary: c.partyId === targetPartyId,
      }));
      const ok = await onSave(lead, {
        contacts: updated.map((c) => ({
          contactPartyId: c.partyId,
          jobTitle: c.jobTitle,
          isPrimary: c.isPrimary,
        })),
      });
      if (ok) {
        setDetail((prev) => (prev ? { ...prev, contacts: updated } : prev));
      }
    },
    [lead, fallbackDetail, editable, onSave],
  );

  // Interactive 3-Star Rating toggle in Header
  const handleToggleRating = useCallback(
    async (starValue: number) => {
      if (!lead || !editable) return;
      const nextRating = localRating === starValue ? 0 : starValue;
      setLocalRating(nextRating);
      await onSave(lead, { rating: nextRating });
    },
    [lead, editable, localRating, onSave],
  );

  // Interactive Board Card Color Picker in Header ("No color" first + 5 colors)
  const handleSelectCardColor = useCallback(
    async (color: CardColor | null) => {
      if (!lead || !editable) return;
      const nextColor = color === null ? null : localCardColor === color ? null : color;
      setLocalCardColor(nextColor);
      await onSave(lead, { cardColor: nextColor });
    },
    [lead, editable, localCardColor, onSave],
  );

  // Attach / Detach Tag handlers
  const handleOpenTagPicker = useCallback(() => {
    if (!editable) return;
    setIsTagPickerOpen((prev) => !prev);
    if (availableTags.length === 0) {
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, { cache: "no-store", maxResponseBytes: 256 * 1024 })
        .then((res) => {
          setAvailableTags(parseCrmTagCatalogue(res.data));
        })
        .catch(() => {});
    }
  }, [editable, availableTags.length]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!lead || !editable) return;
      setLocalTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      setIsTagPickerOpen(false);
      if (isUUIDv7(lead.id) && isUUIDv7(tag.id)) {
        try {
          const res = await axiosClient.post<unknown>(
            `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags`,
            { tagId: tag.id },
            { skipAutoIdempotency: true },
          );
          if (Array.isArray(res.data)) {
            setLocalTags(parseCrmTags(res.data));
          }
        } catch {
          // Keep optimistic tag in UI if offline/mocked
        }
      }
    },
    [lead, editable],
  );

  const handleDetachTag = useCallback(
    async (tagId: string) => {
      if (!lead || !editable) return;
      setLocalTags((prev) => prev.filter((t) => t.id !== tagId));
      if (isUUIDv7(lead.id) && isUUIDv7(tagId)) {
        try {
          await axiosClient.delete(
            `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags/${encodeURIComponent(tagId)}`,
          );
        } catch {
          // Keep optimistic removal
        }
      }
    },
    [lead, editable],
  );

  // Save & Close [Ctrl+S] handler
  const handleSaveAndClose = useCallback(async () => {
    if (!lead) return;
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
    lead,
    isEditingIdentity,
    isEditingQualification,
    editingContactDraft,
    saveIdentitySection,
    saveQualificationSection,
    saveContactPerson,
    onClose,
  ]);

  useEffect(() => {
    if (!lead) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveAndClose();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "j" && prevLead) onNavigateLead(prevLead);
      if (e.key.toLowerCase() === "k" && nextLead) onNavigateLead(nextLead);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lead, prevLead, nextLead, onClose, onNavigateLead, handleSaveAndClose]);

  if (!lead || !fallbackDetail) return null;

  const isCorporate = fallbackDetail.leadProfileType === "CORPORATE";
  const displayStages = stages;
  const currentStage =
    displayStages.find((st) => st.id === fallbackDetail.stageId) ??
    displayStages.find((st) => st.flag === fallbackDetail.stageFlag) ??
    displayStages[0];
  const currentStageIndex = displayStages.findIndex((st) => st.id === currentStage?.id);

  const sourceLabel =
    localizedValue(
      fallbackDetail.acquisitionSourceNameAr,
      fallbackDetail.acquisitionSourceNameEn,
      lang,
    ) ||
    localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang) ||
    "—";

  const ownerFromRef = leadDetailsUserName(
    references.knownUsers.get(fallbackDetail.ownerUserId ?? ""),
  );
  const ownerDisplayName =
    ownerFromRef ||
    (lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}`.trim() : "") ||
    (isAr ? "غير معين" : "Unassigned");

  const locationDisplay = [
    fallbackDetail.address?.city ?? lead.city,
    fallbackDetail.address?.country ?? lead.country,
  ]
    .filter(Boolean)
    .join(", ");

  const activityState = leadActivityState(lead.nextActivity);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Quick Edit ${fallbackDetail.displayName}`}
        className="dossier-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          className="dossier-modal flex max-h-[94vh] w-full max-w-[1460px] flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ================= 1. TOP EXECUTIVE HEADER ================= */}
          <div className="dossier-header">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className={dossierAvatarClass(isCorporate, isConverted)}>
                {getInitials(fallbackDetail.displayName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="dossier-title truncate">{fallbackDetail.displayName}</h2>

                  {/* Corporate vs Individual Badge */}
                  <span
                    className={cn(
                      "dossier-badge",
                      isCorporate ? "dossier-badge-corporate" : "dossier-badge-individual",
                    )}
                  >
                    {isCorporate
                      ? isAr
                        ? "🏢 عميل شركات (CORPORATE)"
                        : "🏢 Corporate Lead"
                      : isAr
                        ? "👤 عميل فردي (INDIVIDUAL)"
                        : "👤 Individual Lead"}
                  </span>

                  {/* Lead Status Badge */}
                  <span className={dossierStatusBadgeClass(fallbackDetail.status)}>
                    {isConverted
                      ? `✓ Status: ${fallbackDetail.status}`
                      : `● Status: ${fallbackDetail.status}`}
                  </span>

                  {/* Stage Badge */}
                  {currentStage && (
                    <span className="dossier-badge dossier-badge-stage">
                      Stage: {localizedName(currentStage, lang)}
                    </span>
                  )}

                  {/* Interactive 3-Star Rating (Fix #1: Working at top header) */}
                  <div
                    className="dossier-stars"
                    role="group"
                    aria-label={isAr ? "تقييم العميل" : "Lead rating"}
                  >
                    {[1, 2, 3].map((starNum) => {
                      const active = starNum <= localRating;
                      return (
                        <button
                          key={starNum}
                          type="button"
                          disabled={!editable}
                          onClick={() => void handleToggleRating(starNum)}
                          aria-label={`Rate ${starNum} of 3 stars`}
                          aria-pressed={active}
                          className={cn(
                            "dossier-star border-0 bg-transparent p-0",
                            !active && "off",
                            !editable && "cursor-default opacity-75",
                          )}
                        >
                          ★
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive Board Card Color Picker Dots ("No Color" first + 5 colors) */}
                  <div
                    className="dossier-color-dots"
                    role="group"
                    aria-label={isAr ? "لون البطاقة" : "Card color"}
                  >
                    {DOSSIER_HEADER_CARD_COLORS.map((opt) => {
                      const isNone = opt.color === null;
                      const isActive = localCardColor === opt.color;
                      return (
                        <button
                          key={opt.color ?? "NONE"}
                          type="button"
                          disabled={!editable}
                          onClick={() => void handleSelectCardColor(opt.color)}
                          title={isAr ? opt.labelAr : isNone ? "No color" : opt.labelEn}
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

                {/* Clean Subtitle Metadata Row (Fix #2: Zero "Core Party #..." & Zero "Centered Quick-Edit Modal") */}
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
                        isAr ? "ar-EG" : "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </b>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Header KPI Counter Pills & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(LEAD_RELATED_ROUTES.opportunities);
                }}
                className={DOSSIER_KPI_PILL_CLASSES.opportunities}
              >
                🚀 Opportunities <b>{relatedCounts.counts.opportunities ?? 0}</b>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(LEAD_RELATED_ROUTES.quotations);
                }}
                className={DOSSIER_KPI_PILL_CLASSES.quotations}
              >
                📄 Quotations <b>{relatedCounts.counts.quotations ?? 0}</b>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(LEAD_RELATED_ROUTES.salesOrders);
                }}
                className={DOSSIER_KPI_PILL_CLASSES.salesOrders}
              >
                📦 Orders <b>{relatedCounts.counts.salesOrders ?? 0}</b>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(LEAD_RELATED_ROUTES.invoices);
                }}
                className={DOSSIER_KPI_PILL_CLASSES.invoices}
              >
                🧾 Invoices <b>{relatedCounts.counts.invoices ?? 0}</b>
              </button>

              {isConverted && fallbackDetail.convertedCustomerProfileId ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(
                      `/crm/customer-profiles/${fallbackDetail.convertedCustomerProfileId}`,
                    );
                  }}
                  className="dossier-btn dossier-btn-emerald"
                >
                  ✓ {isAr ? "عرض ملف العميل ↗" : "View Customer Profile ↗"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (canConvert) {
                      convertState.openModal();
                    } else {
                      onClose();
                      router.push(`/crm/leads/${fallbackDetail.id}`);
                    }
                  }}
                  className="dossier-btn dossier-btn-primary"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "تحويل العميل ←" : "Convert Lead →"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/crm/leads/${fallbackDetail.id}`);
                }}
                className="dossier-btn dossier-btn-outline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>{isAr ? "فتح الصفحة الكاملة" : "Open Full Page"}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="dossier-close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ================= 2. FULL 8-STAGE PIPELINE STEPPER BAR ================= */}
          <div className="dossier-stage-bar">
            <div className="dossier-stage-track">
              {displayStages.map((st, idx) => {
                const isCurrent = st.id === currentStage?.id;
                const isDone =
                  isConverted || (currentStageIndex >= 0 && idx < currentStageIndex);
                const isTermConverted = st.flag === "CONVERTED";

                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={!editable || isCurrent}
                    onClick={() => {
                      if (isTermConverted) {
                        if (canConvert) convertState.openModal();
                        return;
                      }
                      void onMoveStage(lead, st.id);
                      setDetail((prev) =>
                        prev ? { ...prev, stageId: st.id, stageFlag: st.flag } : prev,
                      );
                    }}
                    className={dossierStageCellClass({
                      flag: st.flag,
                      isCurrent,
                      isPast: isDone && !isCurrent,
                    })}
                  >
                    {isDone && !isCurrent && (
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {isTermConverted && !isCurrent && (
                      <Lock className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">
                      {isCurrent
                        ? `● ${localizedName(st, lang)} (${isAr ? "الحالية" : "Current"})`
                        : localizedName(st, lang)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= 3. CONVERTED LOCKED RECEIPT BANNER (CASE 6) ================= */}
          {isConverted && (
            <div className="dossier-converted-banner">
              <div>
                <h4>
                  🎉{" "}
                  {isAr
                    ? "تم تحويل هذا العميل المحتمل إلى عميل فعلي"
                    : "Lead Successfully Converted to Customer"}
                </h4>
                <p>
                  {isAr
                    ? "هذا السجل مقفل للقراءة فقط للحفاظ على سجل التدقيق التاريخي."
                    : "This lead is now locked in read-only mode to preserve historical audit integrity."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fallbackDetail.convertedCustomerProfileId && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(
                        `/crm/customer-profiles/${fallbackDetail.convertedCustomerProfileId}`,
                      );
                    }}
                    className="dossier-btn dossier-btn-outline"
                  >
                    🏢 Customer Profile ↗
                  </button>
                )}
                {fallbackDetail.convertedOpportunityId && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(
                        `/crm/opportunities/${fallbackDetail.convertedOpportunityId}`,
                      );
                    }}
                    className="dossier-btn dossier-btn-emerald"
                  >
                    🚀 Opportunity ↗
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section Validation / Write Error Alert */}
          {sectionError && (
            <div
              role="alert"
              className="mx-5 mt-3 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
            >
              {sectionError}
            </div>
          )}

          {/* ================= 4. TWO-COLUMN DOSSIER BODY ================= */}
          <div className="dossier-body">
            {/* ---------------- LEFT COLUMN (7/12) ---------------- */}
            <div className="dossier-col">
              {/* CARD 1A: CORPORATE COMPANY DETAILS (Shown ONLY when CORPORATE — Fix #4) */}
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
                          ? isAr
                            ? "تعديل بيانات الشركة وأرقام الهواتف"
                            : "Editing Company Details & Phones"
                          : isAr
                            ? "بيانات الشركة"
                            : "Company Details"}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only (Converted)
                      </span>
                    ) : isEditingIdentity ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => {
                            setIsEditingIdentity(false);
                            setSectionError(null);
                          }}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {isAr ? "إلغاء" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => void saveIdentitySection()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {isAr ? "حفظ الشركة" : "Save Company"}
                        </button>
                      </div>
                    ) : (
                      editable && (
                        <button
                          type="button"
                          onClick={startIdentityEdit}
                          className="dossier-edit-btn"
                        >
                          ✏️ {isAr ? "تعديل بيانات الشركة" : "Edit Company Details"}
                        </button>
                      )
                    )}
                  </div>

                  <div className="dossier-card-body">
                    {!isEditingIdentity ? (
                      <>
                        {/* Company Phones in View Mode with Edit Button & Call/WA/TG (Fix #5) */}
                        <div className="dossier-phone-box-view">
                          <div className="dossier-phone-box-head">
                            <span className="dossier-phone-box-label">
                              📞 Company Phone Numbers (companyPhones — View Mode)
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={startIdentityEdit}
                                className="dossier-edit-btn"
                              >
                                ✏️ {isAr ? "تعديل الأرقام (كود + رقم)" : "Edit Phones (Code + Number)"}
                              </button>
                            )}
                          </div>
                          {fallbackDetail.phones.length > 0 ? (
                            fallbackDetail.phones.map((ph, idx) => (
                              <div key={`${ph}-${idx}`} className="dossier-phone-item-view">
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
                                  country={fallbackDetail.address?.country ?? lead.country}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">
                              {isAr ? "لا توجد أرقام مسجلة" : "No company phone numbers recorded"}
                            </div>
                          )}
                        </div>

                        {/* Company Fields Grid (View Mode — Zero "Click any field to edit in-place") */}
                        <div className="dossier-grid-2">
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Company Name</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.companyName || fallbackDetail.displayName}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Company Email</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.companyEmail || fallbackDetail.email ? (
                                <a
                                  href={`mailto:${fallbackDetail.companyEmail || fallbackDetail.email}`}
                                >
                                  ✉️ {fallbackDetail.companyEmail || fallbackDetail.email}
                                </a>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Tax Number</div>
                            <div className="dossier-field-val mono">
                              {fallbackDetail.taxNumber || <span className="muted">—</span>}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Commercial Reg. No.</div>
                            <div className="dossier-field-val mono">
                              {fallbackDetail.commercialRegistrationNumber || (
                                <span className="muted">—</span>
                              )}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Company Website</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.companyWebsite ? (
                                <a
                                  href={
                                    fallbackDetail.companyWebsite.startsWith("http")
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
                              Address Type & Country / City
                            </div>
                            <div className="dossier-field-val">
                              {fallbackDetail.address ? (
                                <>
                                  <span className="dossier-badge dossier-badge-corporate me-1.5">
                                    {fallbackDetail.address.addressType}
                                  </span>
                                  {[
                                    fallbackDetail.address.country,
                                    fallbackDetail.address.city,
                                    fallbackDetail.address.area,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </>
                              ) : (
                                [lead.country, lead.city].filter(Boolean).join(" · ") || "—"
                              )}
                            </div>
                          </div>
                          <div className="dossier-field-box dossier-span-all">
                            <div className="dossier-field-label">Full Legal Address</div>
                            <div className="dossier-field-val">
                              📍 {formatFullAddress(fallbackDetail.address)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* CORPORATE EDIT MODE (Case 2 — Split Phone Code + National Number & Structured Address) */
                      <>
                        <div className="dossier-phone-box-edit">
                          <div className="dossier-phone-box-head">
                            <span className="dossier-phone-box-label">
                              📞 Company Phones — Split Country Code + National Number
                              (CrmPhoneNumberInput)
                            </span>
                            {phonesDraft.length < 10 && (
                              <button
                                type="button"
                                onClick={() => setPhonesDraft((prev) => [...prev, ""])}
                                className="dossier-add-phone-btn"
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                                <span>{isAr ? "إضافة رقم" : "Add Phone"}</span>
                              </button>
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
                                    prev.map((item, i) => (i === idx ? next : item)),
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
                              <button
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
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <div className="dossier-phone-hint">
                            ✓ Automatically strips leading trunk 0 • Splits pasted international
                            numbers (+20 / 0020) • Validates E.164 format
                          </div>
                        </div>

                        <div className="dossier-grid-2">
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="corp-company-name">
                              Company Name *
                            </label>
                            <input
                              id="corp-company-name"
                              className="dossier-input"
                              value={companyNameDraft}
                              onChange={(e) => setCompanyNameDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="corp-company-email">
                              Company Email
                            </label>
                            <input
                              id="corp-company-email"
                              className="dossier-input"
                              value={companyEmailDraft}
                              onChange={(e) => setCompanyEmailDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="corp-tax-number">
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
                            <label className="dossier-field-label" htmlFor="corp-cr-number">
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
                            <label className="dossier-field-label" htmlFor="corp-website">
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

                        {/* Structured Address Inputs */}
                        <div className="dossier-grid-4">
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-country">
                              Country
                            </label>
                            <input
                              id="addr-country"
                              className="dossier-input"
                              value={countryDraft}
                              onChange={(e) => setCountryDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-city">
                              City
                            </label>
                            <input
                              id="addr-city"
                              className="dossier-input"
                              value={cityDraft}
                              onChange={(e) => setCityDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-area">
                              Area / District
                            </label>
                            <input
                              id="addr-area"
                              className="dossier-input"
                              value={areaDraft}
                              onChange={(e) => setAreaDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-postal">
                              Postal Code
                            </label>
                            <input
                              id="addr-postal"
                              className="dossier-input mono"
                              value={postalCodeDraft}
                              onChange={(e) => setPostalCodeDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-street">
                              Street
                            </label>
                            <input
                              id="addr-street"
                              className="dossier-input"
                              value={streetDraft}
                              onChange={(e) => setStreetDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-bldg">
                              Building No.
                            </label>
                            <input
                              id="addr-bldg"
                              className="dossier-input"
                              value={buildingNoDraft}
                              onChange={(e) => setBuildingNoDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-floor">
                              Floor / Apt
                            </label>
                            <input
                              id="addr-floor"
                              className="dossier-input"
                              value={floorDraft}
                              onChange={(e) => setFloorDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="addr-landmark">
                              Landmark
                            </label>
                            <input
                              id="addr-landmark"
                              className="dossier-input"
                              value={landmarkDraft}
                              onChange={(e) => setLandmarkDraft(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* CARD 1B: INDIVIDUAL PERSONAL & CONTACT INFORMATION (Cases 4, 5, 8 — Zero Company Details!) */
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
                          ? isAr
                            ? "تعديل البيانات الشخصية وأرقام الموبايل"
                            : "Editing Personal & Contact Information"
                          : isAr
                            ? "البيانات الشخصية وبيانات التواصل"
                            : "Personal & Contact Information"}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only (Converted)
                      </span>
                    ) : isEditingIdentity ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => {
                            setIsEditingIdentity(false);
                            setSectionError(null);
                          }}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {isAr ? "إلغاء" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => void saveIdentitySection()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {isAr ? "حفظ البيانات الشخصية" : "Save Personal Info"}
                        </button>
                      </div>
                    ) : (
                      editable && (
                        <button
                          type="button"
                          onClick={startIdentityEdit}
                          className="dossier-edit-btn"
                        >
                          ✏️ {isAr ? "تعديل البيانات الشخصية" : "Edit Personal Info"}
                        </button>
                      )
                    )}
                  </div>

                  <div className="dossier-card-body">
                    {!isEditingIdentity ? (
                      <>
                        {/* Personal Mobile Numbers in View Mode (Fix #5) */}
                        <div className="dossier-phone-box-view">
                          <div className="dossier-phone-box-head">
                            <span className="dossier-phone-box-label">
                              📱 Personal Mobile Numbers (phones[] — View Mode)
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={startIdentityEdit}
                                className="dossier-edit-btn"
                              >
                                ✏️ {isAr ? "تعديل الأرقام (كود + رقم)" : "Edit Phones (Code + Number)"}
                              </button>
                            )}
                          </div>
                          {fallbackDetail.phones.length > 0 ? (
                            fallbackDetail.phones.map((ph, idx) => (
                              <div key={`${ph}-${idx}`} className="dossier-phone-item-view">
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
                                  country={fallbackDetail.address?.country ?? lead.country}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">
                              {isAr ? "لا توجد أرقام موبايل مسجلة" : "No mobile numbers recorded"}
                            </div>
                          )}
                        </div>

                        <div className="dossier-grid-4">
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Honorific Title</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.honorificTitle || <span className="muted">—</span>}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">First Name</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.firstName ||
                                fallbackDetail.displayName.split(" ")[0] ||
                                "—"}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Last Name</div>
                            <div className="dossier-field-val">
                              {fallbackDetail.lastName ||
                                fallbackDetail.displayName.split(" ").slice(1).join(" ") ||
                                "—"}
                            </div>
                          </div>
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Display Name</div>
                            <div className="dossier-field-val">{fallbackDetail.displayName}</div>
                          </div>
                        </div>

                        <div className="dossier-grid-2">
                          <div className="dossier-field-box">
                            <div className="dossier-field-label">Personal Email</div>
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
                            <div className="dossier-field-label">Country / City / Area</div>
                            <div className="dossier-field-val">
                              {[
                                fallbackDetail.address?.country ?? lead.country,
                                fallbackDetail.address?.city ?? lead.city,
                                fallbackDetail.address?.area,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          <div className="dossier-field-box dossier-span-all">
                            <div className="dossier-field-label">Personal / Clinic Address</div>
                            <div className="dossier-field-val">
                              📍 {formatFullAddress(fallbackDetail.address)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* INDIVIDUAL EDIT MODE (Case 5 — Split Country Code + National Number) */
                      <>
                        <div className="dossier-grid-4">
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-honorific">
                              Honorific Title
                            </label>
                            <select
                              id="ind-honorific"
                              className="dossier-select"
                              value={findHonorific(honorificDraft, lang)?.label ?? honorificDraft}
                              onChange={(e) => setHonorificDraft(e.target.value)}
                            >
                              <option value="">{isAr ? "بدون لقب" : "None"}</option>
                              {getHonorificOptions(lang).map((opt) => (
                                <option key={opt.key} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                              {honorificDraft &&
                                !findHonorific(honorificDraft, lang) && (
                                  <option value={honorificDraft}>{honorificDraft}</option>
                                )}
                            </select>
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-first-name">
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
                            <label className="dossier-field-label" htmlFor="ind-last-name">
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
                            <label className="dossier-field-label" htmlFor="ind-display-name">
                              Display Name
                            </label>
                            <input
                              id="ind-display-name"
                              className="dossier-input"
                              value={displayNameDraft}
                              onChange={(e) => setDisplayNameDraft(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="dossier-phone-box-edit">
                          <div className="dossier-phone-box-head">
                            <span className="dossier-phone-box-label">
                              📱 Personal Mobile Numbers — Split Country Code + National Number
                              (CrmPhoneNumberInput)
                            </span>
                            {phonesDraft.length < 10 && (
                              <button
                                type="button"
                                onClick={() => setPhonesDraft((prev) => [...prev, ""])}
                                className="dossier-add-phone-btn"
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                                <span>{isAr ? "إضافة موبايل" : "Add Mobile"}</span>
                              </button>
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
                                    prev.map((item, i) => (i === idx ? next : item)),
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
                              <button
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
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <div className="dossier-phone-hint">
                            ✓ Automatically strips leading trunk 0 • Splits pasted international
                            numbers • Validates E.164 format
                          </div>
                        </div>

                        <div className="dossier-grid-4">
                          <div className="dossier-field-box dossier-span-2">
                            <label className="dossier-field-label" htmlFor="ind-email">
                              Personal Email
                            </label>
                            <input
                              id="ind-email"
                              className="dossier-input"
                              value={personalEmailDraft}
                              onChange={(e) => setPersonalEmailDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-country">
                              Country
                            </label>
                            <input
                              id="ind-country"
                              className="dossier-input"
                              value={countryDraft}
                              onChange={(e) => setCountryDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-city">
                              City
                            </label>
                            <input
                              id="ind-city"
                              className="dossier-input"
                              value={cityDraft}
                              onChange={(e) => setCityDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-area">
                              Area
                            </label>
                            <input
                              id="ind-area"
                              className="dossier-input"
                              value={areaDraft}
                              onChange={(e) => setAreaDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-street">
                              Street
                            </label>
                            <input
                              id="ind-street"
                              className="dossier-input"
                              value={streetDraft}
                              onChange={(e) => setStreetDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-bldg">
                              Building / Floor
                            </label>
                            <input
                              id="ind-bldg"
                              className="dossier-input"
                              value={buildingNoDraft}
                              onChange={(e) => setBuildingNoDraft(e.target.value)}
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ind-landmark">
                              Landmark
                            </label>
                            <input
                              id="ind-landmark"
                              className="dossier-input"
                              value={landmarkDraft}
                              onChange={(e) => setLandmarkDraft(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* CARD 2: QUALIFICATION, OWNERSHIP & CUSTOM FIELDS */}
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
                        ? isAr
                          ? "تعديل التأهيل والمسؤول والحقول المخصصة"
                          : "Editing Qualification, Ownership & Custom Fields"
                        : isAr
                          ? "التأهيل والمسؤول والحقول المخصصة"
                          : "Qualification, Ownership & Custom Fields"}
                    </span>
                  </div>
                  {isConverted ? (
                    <span className="dossier-badge dossier-badge-converted">
                      🔒 Read-Only (Converted)
                    </span>
                  ) : isEditingQualification ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => {
                          setIsEditingQualification(false);
                          setSectionError(null);
                        }}
                        className="dossier-edit-btn dossier-cancel-btn"
                      >
                        ✕ {isAr ? "إلغاء" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={isSavingSection}
                        onClick={() => void saveQualificationSection()}
                        className="dossier-edit-btn dossier-save-btn"
                      >
                        ✓ {isAr ? "حفظ التأهيل" : "Save Qualification"}
                      </button>
                    </div>
                  ) : (
                    editable && (
                      <button
                        type="button"
                        onClick={startQualificationEdit}
                        className="dossier-edit-btn"
                      >
                        ✏️ {isAr ? "تعديل التأهيل" : "Edit Qualification"}
                      </button>
                    )
                  )}
                </div>

                <div className="dossier-card-body">
                  {!isEditingQualification ? (
                    <>
                      <div className="dossier-grid-3">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Salesperson (Owner)</div>
                          <div className="dossier-field-val">👤 {ownerDisplayName}</div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Acquisition Source</div>
                          <div className="dossier-field-val">🌐 {sourceLabel}</div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Updated At</div>
                          <div className="dossier-field-val">
                            {new Date(fallbackDetail.updatedAt).toLocaleDateString(
                              isAr ? "ar-EG" : "en-US",
                              { month: "short", day: "numeric", year: "numeric" },
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="dossier-grid-2">
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Interest Summary</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.interestSummary || <span className="muted">—</span>}
                          </div>
                        </div>
                        <div className="dossier-field-box">
                          <div className="dossier-field-label">Expected Need</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.expectedNeed || <span className="muted">—</span>}
                          </div>
                        </div>
                        <div className="dossier-field-box dossier-span-all">
                          <div className="dossier-field-label">Description / Internal Notes</div>
                          <div className="dossier-field-val">
                            {fallbackDetail.description || <span className="muted">—</span>}
                          </div>
                        </div>

                        {/* Lead Tags Row */}
                        <div className="dossier-field-box dossier-span-all">
                          <div className="dossier-field-label">Lead Tags</div>
                          <div className="dossier-tags">
                            {localTags.map((tag, idx) => {
                              const toneClass =
                                DOSSIER_TAG_TONE_CLASSES[idx % DOSSIER_TAG_TONE_CLASSES.length];
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
                                    <button
                                      type="button"
                                      aria-label={`Remove tag ${tag.name}`}
                                      onClick={() => void handleDetachTag(tag.id)}
                                      className="ms-1 border-0 bg-transparent p-0 font-extrabold opacity-75 hover:opacity-100"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                            {editable && (
                              <button
                                type="button"
                                onClick={handleOpenTagPicker}
                                className="dossier-tag dossier-tag-add"
                              >
                                + {isAr ? "ربط وسم" : "Attach Tag"}
                              </button>
                            )}
                          </div>
                          {isTagPickerOpen && availableTags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-800 dark:bg-violet-950/40">
                              {availableTags.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => void handleAttachTag(tag)}
                                  className="dossier-tag dossier-tag-indigo"
                                >
                                  + {tag.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Qualification Edit Mode */
                    <div className="dossier-grid-2">
                      <div className="dossier-field-box">
                        <label className="dossier-field-label" htmlFor="qual-owner">
                          Salesperson (Owner)
                        </label>
                        <select
                          id="qual-owner"
                          className="dossier-select"
                          value={ownerUserIdDraft}
                          onChange={(e) => setOwnerUserIdDraft(e.target.value)}
                        >
                          <option value="">{ownerDisplayName}</option>
                          {references.ownerOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {leadDetailsUserName(u)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="dossier-field-box">
                        <label className="dossier-field-label" htmlFor="qual-source">
                          Acquisition Source
                        </label>
                        <select
                          id="qual-source"
                          className="dossier-select"
                          value={sourceIdDraft}
                          onChange={(e) => setSourceIdDraft(e.target.value)}
                        >
                          <option value="">{isAr ? "بدون مصدر" : "No Source"}</option>
                          {sources.map((src) => (
                            <option key={src.id} value={src.id}>
                              {localizedValue(src.nameAr, src.nameEn, lang)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="dossier-field-box">
                        <label className="dossier-field-label" htmlFor="qual-interest">
                          Interest Summary
                        </label>
                        <input
                          id="qual-interest"
                          className="dossier-input"
                          value={interestSummaryDraft}
                          onChange={(e) => setInterestSummaryDraft(e.target.value)}
                        />
                      </div>
                      <div className="dossier-field-box">
                        <label className="dossier-field-label" htmlFor="qual-need">
                          Expected Need
                        </label>
                        <input
                          id="qual-need"
                          className="dossier-input"
                          value={expectedNeedDraft}
                          onChange={(e) => setExpectedNeedDraft(e.target.value)}
                        />
                      </div>
                      <div className="dossier-field-box dossier-span-all">
                        <label className="dossier-field-label" htmlFor="qual-description">
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
                  {customFieldValues.entries.length > 0 && (
                    <div className="dossier-custom-fields-section">
                      <div className="dossier-custom-fields-head">
                        <span>✨ Custom Fields (Tenant Lead Schema)</span>
                        <span className="dossier-badge dossier-badge-individual">
                          Dynamic Custom Fields
                        </span>
                      </div>
                      <div className="dossier-grid-3">
                        {customFieldValues.entries.map(({ definition, value }) => {
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
                            <div key={definition.id} className="dossier-field-box">
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
                                <div className="dossier-field-val">{displayVal}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------- RIGHT COLUMN (5/12) ---------------- */}
            <div className="dossier-col">
              {/* CORPORATE ONLY: CONTACT PERSONS CARD (Hidden for Individual Leads — Fix #4) */}
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
                            ? isAr
                              ? "تعديل جهة الاتصال"
                              : `Editing Contact Person (${editingContactDraft.firstName})`
                            : isAr
                              ? "إضافة جهة اتصال"
                              : "Adding Contact Person"
                          : `${isAr ? "جهات الاتصال" : "Contact Persons"} (${fallbackDetail.contacts.length})`}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only
                      </span>
                    ) : editingContactDraft ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => setEditingContactDraft(null)}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {isAr ? "إلغاء" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingSection}
                          onClick={() => void saveContactPerson()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {isAr ? "حفظ جهة الاتصال" : "Save Contact"}
                        </button>
                      </div>
                    ) : (
                      editable && (
                        <button
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
                          + {isAr ? "إضافة جهة اتصال" : "Add Contact Person"}
                        </button>
                      )
                    )}
                  </div>

                  <div className="dossier-card-body">
                    {editingContactDraft && (
                      <div className="dossier-phone-box-edit">
                        <div className="dossier-grid-3">
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ct-honorific">
                              Honorific Title
                            </label>
                            <select
                              id="ct-honorific"
                              className="dossier-select"
                              value={
                                findHonorific(editingContactDraft.honorificTitle, lang)?.label ??
                                editingContactDraft.honorificTitle
                              }
                              onChange={(e) =>
                                setEditingContactDraft((prev) =>
                                  prev ? { ...prev, honorificTitle: e.target.value } : prev,
                                )
                              }
                            >
                              <option value="">{isAr ? "بدون لقب" : "None"}</option>
                              {getHonorificOptions(lang).map((opt) => (
                                <option key={opt.key} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                              {editingContactDraft.honorificTitle &&
                                !findHonorific(editingContactDraft.honorificTitle, lang) && (
                                  <option value={editingContactDraft.honorificTitle}>
                                    {editingContactDraft.honorificTitle}
                                  </option>
                                )}
                            </select>
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ct-first-name">
                              First Name *
                            </label>
                            <input
                              id="ct-first-name"
                              className="dossier-input"
                              value={editingContactDraft.firstName}
                              onChange={(e) =>
                                setEditingContactDraft((prev) =>
                                  prev ? { ...prev, firstName: e.target.value } : prev,
                                )
                              }
                            />
                          </div>
                          <div className="dossier-field-box">
                            <label className="dossier-field-label" htmlFor="ct-last-name">
                              Last Name
                            </label>
                            <input
                              id="ct-last-name"
                              className="dossier-input"
                              value={editingContactDraft.lastName}
                              onChange={(e) =>
                                setEditingContactDraft((prev) =>
                                  prev ? { ...prev, lastName: e.target.value } : prev,
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
                            <label className="dossier-field-label" htmlFor="ct-email">
                              Contact Email
                            </label>
                            <input
                              id="ct-email"
                              className="dossier-input"
                              value={editingContactDraft.email}
                              onChange={(e) =>
                                setEditingContactDraft((prev) =>
                                  prev ? { ...prev, email: e.target.value } : prev,
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="dossier-phone-box-head mt-1">
                          <span className="dossier-phone-box-label">
                            📱 Contact Mobile Numbers (Split Code + Number)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContactDraft((prev) =>
                                prev ? { ...prev, phones: [...prev.phones, ""] } : prev,
                              )
                            }
                            className="dossier-add-phone-btn"
                          >
                            + Add Number
                          </button>
                        </div>

                        {editingContactDraft.phones.map((ph, idx) => (
                          <div key={idx} className="dossier-phone-split-row">
                            <CrmPhoneNumberInput
                              value={ph}
                              maxLength={32}
                              label={`Contact Mobile ${idx + 1}`}
                              placeholder="1229988776"
                              onChange={(next) =>
                                setEditingContactDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        phones: prev.phones.map((item, i) =>
                                          i === idx ? next : item,
                                        ),
                                      }
                                    : prev,
                                )
                              }
                              onBlur={() => {}}
                            />
                            <button
                              type="button"
                              aria-label={`Remove contact phone ${idx + 1}`}
                              onClick={() =>
                                setEditingContactDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        phones:
                                          prev.phones.length === 1
                                            ? [""]
                                            : prev.phones.filter((_, i) => i !== idx),
                                      }
                                    : prev,
                                )
                              }
                              className="dossier-del-btn"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contact Cards List — Hide the contact card currently being edited! */}
                    {fallbackDetail.contacts.length > 0 ? (
                      fallbackDetail.contacts
                        .filter(
                          (ct) =>
                            !editingContactDraft || ct.partyId !== editingContactDraft.partyId,
                        )
                        .map((ct) => (
                          <div
                            key={ct.partyId}
                            className={cn("dossier-contact-card", ct.isPrimary && "primary")}
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
                                  {[ct.jobTitle, ct.email ? `✉️ ${ct.email}` : null]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </div>
                              </div>
                            </div>

                            {editable && (
                              <div className="flex items-center gap-1.5">
                                {!ct.isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSetPrimaryContact(ct.partyId)}
                                    className="dossier-edit-btn"
                                  >
                                    ★ Set Primary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingContactDraft({
                                      partyId: ct.partyId,
                                      honorificTitle: ct.honorificTitle ?? "",
                                      firstName:
                                        ct.firstName ?? ct.displayName.split(" ")[0] ?? "",
                                      lastName:
                                        ct.lastName ??
                                        ct.displayName.split(" ").slice(1).join(" ") ??
                                        "",
                                      jobTitle: ct.jobTitle ?? "",
                                      email: ct.email ?? "",
                                      phones: ct.phones.length > 0 ? [...ct.phones] : [""],
                                      isPrimary: ct.isPrimary,
                                    })
                                  }
                                  className="dossier-edit-btn"
                                >
                                  ✏️ Edit
                                </button>
                              </div>
                            )}
                          </div>

                          {ct.phones.map((ph, idx) => (
                            <div key={`${ph}-${idx}`} className="dossier-phone-item-view">
                              <span className="dossier-phone-num" dir="ltr">
                                📱 {formatPhoneDisplay(ph)}
                              </span>
                              <PhoneActionPills
                                phone={ph}
                                country={fallbackDetail.address?.country ?? lead.country}
                              />
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-cyan-300 p-3 text-center text-xs text-slate-500 dark:border-cyan-800">
                        {isAr
                          ? "لا توجد جهات اتصال مسجلة لهذه الشركة"
                          : "No contact persons recorded for this company"}
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
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeDossierTab === "activities"}
                      onClick={() => setActiveDossierTab("activities")}
                      className={cn(
                        "dossier-tab",
                        activeDossierTab === "activities" && "active",
                      )}
                    >
                      📅 {isAr ? "الأنشطة" : "Activities"} (
                      {lead.nextActivity ? 1 : 0})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeDossierTab === "notes"}
                      onClick={() => setActiveDossierTab("notes")}
                      className={cn("dossier-tab", activeDossierTab === "notes" && "active")}
                    >
                      📝 {isAr ? "الملاحظات" : "Notes"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeDossierTab === "history"}
                      onClick={() => setActiveDossierTab("history")}
                      className={cn(
                        "dossier-tab",
                        activeDossierTab === "history" && "active",
                      )}
                    >
                      🕒 {isAr ? "سجل التدقيق" : "Audit Log"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeDossierTab === "files"}
                      onClick={() => setActiveDossierTab("files")}
                      className={cn("dossier-tab", activeDossierTab === "files" && "active")}
                    >
                      📎 {isAr ? "الملفات" : "Files"}
                    </button>
                  </div>

                  {activeDossierTab === "activities" && !isConverted && (
                    <button
                      type="button"
                      onClick={() => onOpenActivities(lead)}
                      className="dossier-edit-btn"
                    >
                      + {isAr ? "حجز نشاط" : "Book Activity"}
                    </button>
                  )}
                </div>

                <div className="dossier-card-body">
                  {activeDossierTab === "activities" && (
                    <div className="flex flex-col gap-3">
                      {lead.nextActivity ? (
                        <div className="dossier-activity-card">
                          <div className="flex items-center justify-between gap-2">
                            <span className="dossier-activity-title">
                              📞{" "}
                              {isAr ? "نشاط متابعة قادم" : "Next Scheduled Follow-Up"}
                            </span>
                            <span
                              className={cn(
                                "dossier-badge",
                                activityState === "OVERDUE"
                                  ? "bg-red-100 text-red-700 border-red-300"
                                  : "dossier-badge-stage",
                              )}
                            >
                              {activityState === "OVERDUE" ? "OVERDUE" : "SCHEDULED"} •{" "}
                              {new Date(lead.nextActivity.activityAt).toLocaleDateString(
                                isAr ? "ar-EG" : "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          </div>
                          <div className="dossier-activity-meta">
                            Status: {lead.nextActivity.bucket} • Assigned to:{" "}
                            {ownerDisplayName}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-amber-300 p-4 text-center dark:border-amber-800">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {isAr
                              ? "لا توجد أنشطة مجدولة حالياً"
                              : "No scheduled activities"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {isAr
                              ? "اضغط على (+ حجز نشاط) لجدولة مكالمة أو اجتماع"
                              : "Click (+ Book Activity) to schedule a call, meeting, or follow-up."}
                          </p>
                        </div>
                      )}

                      {isUUIDv7(fallbackDetail.id) && (
                        <RecordActivitiesPanel
                          target={{
                            app: "CRM",
                            type: "LEAD",
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
                      sourceType="LEAD"
                      sourceId={fallbackDetail.id}
                      sourceOwnerUserId={fallbackDetail.ownerUserId}
                      createCapability={capabilities.notesCreate}
                      deleteCapability={capabilities.notesDelete}
                      readOnly={!editable}
                    />
                  )}

                  {activeDossierTab === "history" && (
                    <EntityHistoryCard
                      density="compact"
                      entityType="Lead"
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
                      sourceType="LEAD"
                      sourceId={fallbackDetail.id}
                      sourceOwnerUserId={fallbackDetail.ownerUserId}
                      createCapability={capabilities.attachmentsCreate}
                      deleteCapability={capabilities.attachmentsDelete}
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
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span>
                Navigate Leads in Stage ({currentIndex >= 0 ? currentIndex + 1 : 1} of{" "}
                {Math.max(leads.length, 1)}):
              </span>
              <button
                type="button"
                disabled={!prevLead}
                onClick={() => prevLead && onNavigateLead(prevLead)}
                className="dossier-btn dossier-btn-outline disabled:opacity-40"
              >
                ← Prev Lead [J]
              </button>
              <button
                type="button"
                disabled={!nextLead}
                onClick={() => nextLead && onNavigateLead(nextLead)}
                className="dossier-btn dossier-btn-outline disabled:opacity-40"
              >
                Next Lead [K] →
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {canDelete && onDeleteLead && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteLead(lead);
                  }}
                  className="dossier-btn dossier-btn-danger"
                >
                  🗑️ {isAr ? "حذف العميل" : "Delete Lead"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="dossier-btn dossier-btn-outline"
              >
                {isAr ? "إغلاق [Esc]" : "Close [Esc]"}
              </button>
              {!isConverted && (
                <button
                  type="button"
                  disabled={isSavingSection}
                  onClick={() => void handleSaveAndClose()}
                  className="dossier-btn dossier-btn-primary"
                >
                  ✓ {isAr ? "حفظ وإغلاق [Ctrl+S]" : "Save & Close [Ctrl+S]"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Convert Lead Modal */}
      <LeadConvertModal convert={convertState} />
    </>
  );
}
