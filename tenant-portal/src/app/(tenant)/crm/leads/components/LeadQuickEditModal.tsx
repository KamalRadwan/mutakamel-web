"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  ErrorState,
  PermissionGate,
  Skeleton,
  DOSSIER_CARD_TONE_CLASSES,
  DOSSIER_HEADER_CARD_COLORS,
  DOSSIER_KPI_PILL_CLASSES,
  DOSSIER_TAG_TONE_CLASSES,
  type CardColor,
  cn,
  useToast,
  dossierAvatarClass,
  dossierStageCellClass,
  dossierStatusBadgeClass,
} from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, isAmbiguousWriteFailure, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { INTL_LOCALE } from "@/lib/format/locale";
import { getCountryOptions, splitPhoneNumber } from "@/lib/geo/country-data";
import { isUUIDv7 } from "@/lib/uuid";
import { CrmJobTitleField } from "../../shared/components/CrmJobTitleField";
import { CrmPhoneNumberInput } from "../../shared/components/CrmPhoneNumberInput";
import { RecordAttachmentsSection } from "../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../shared/components/RecordNotesSection";
import { crmCapabilityAllowsOwner } from "../../shared/crm-capabilities";
import { CrmErrorBag } from "../../shared/crm-form-validation";
import { CRM_RATING_STARS } from "../../shared/crm-rating-contract";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmCustomFieldValues } from "../../shared/hooks/useCrmCustomFieldValues";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../shared/tag-contract";
import { LeadConvertModal } from "../[id]/components/LeadConvertModal";
import {
  CONTACT_DIRECTORY_PERMISSIONS,
  ContactWriteResponseError,
  buildAddedContactLeadRequest,
  buildContactCoreWrites,
  buildSelectedContactLeadRequest,
  contactModalForm,
  contactPersonPath,
  parseContactPerson,
  validateContactModal,
  validateContactWriteResponse,
  validateNewLeadContact,
} from "../[id]/contact-modal-contract";
import { useLeadConvert } from "../[id]/hooks/useLeadConvert";
import { useLeadDetailsReferences } from "../[id]/hooks/useLeadDetailsReferences";
import { useLeadRelatedCounts } from "../[id]/hooks/useLeadRelatedCounts";
import { leadDetailsUserName } from "../[id]/lead-details-edit-contract";
import { buildLeadRelatedHref } from "../[id]/lead-related-contract";
import { useLeadCapabilities } from "../hooks/useLeadCapabilities";
import { useLeadQuickEditWrites } from "../hooks/useLeadCardWrites";
import type { LeadWriteOutcome } from "../hooks/useLeadMutations";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { leadActivityState, leadNameInitials } from "../lead-card-contract";
import {
  leadPath,
  parseLeadDetailResponse,
  type LeadDetail,
} from "../lead-contract";
import { fetchLeadDetail } from "../lead-requests";
import { LeadPhoneActionsRow } from "./LeadPhoneActionsRow";
import {
  buildLeadCompanyFieldRequest,
  buildLeadCompanyPhonesRequest,
  type UpdateLeadRequest,
} from "../lead-write-contract";

interface LeadQuickEditModalProps {
  lead: LeadItem | null;
  leads: readonly LeadItem[];
  stages: readonly LeadStage[];
  branchId?: string | null;
  canUpdate: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onNavigateLead: (nextLead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => Promise<LeadWriteOutcome>;
  onOpenActivities: (lead: LeadItem) => void;
  onSave: (lead: LeadItem, request: UpdateLeadRequest) => Promise<LeadWriteOutcome>;
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

function formatPhoneDisplay(rawPhone: string): string {
  const split = splitPhoneNumber(rawPhone);
  if (!split) return rawPhone;
  const { callingCode, nationalNumber } = split;
  if (!callingCode) return rawPhone;
  const countries = getCountryOptions("en").filter((country) => country.callingCode === callingCode);
  // A shared calling code cannot identify a country by itself.
  const flag = countries.length === 1 ? countries[0].flag : "🌐";
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

function LeadQuickEditLoadState({ error, onRetry, onClose }: {
  error: NormalizedApiError | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}>
        <DialogTitle>{t.crmLeadDetail.editTitle}</DialogTitle>
        {error ? (
          <div role="alert">
            {error.status === 403 ? (
              <>
                <PermissionGate require="crm.leads.read" scoped denied>
                  {null}
                </PermissionGate>
                <Button variant="outline" onClick={onRetry}>
                  {t.common.retry}
                </Button>
              </>
            ) : (
              <ErrorState
                title={t.crmLeadDetail.loadFailed}
                onRetry={onRetry}
                retryLabel={t.common.retry}
              />
            )}
          </div>
        ) : (
          <div role="status" aria-busy="true" className="space-y-3">
            <p>{t.common.loading}</p>
            <Skeleton className="h-32" />
          </div>
        )}
        <Button variant="outline" onClick={onClose}>
          {t.common.close}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

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
  const { t, lang } = useI18n();
  const canReadHistory = useAuditAccess();
  const { user } = useTenantAuth();
  const toast = useToast();
  const router = useRouter();
  const { canMutate } = useAccessMode();
  const { items: sources } = useCrmAcquisitionSources();

  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailRequest, setDetailRequest] = useState<{
    lead: LeadItem;
    branchId: string | null;
  } | null>(null);
  const [detailError, setDetailError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // A new selection must not reuse the previous lead's detail before its effect runs.
  const isCurrentDetail = detailRequest?.lead === lead && detailRequest?.branchId === branchId;
  const currentDetail = isCurrentDetail ? detail : null;
  const [localRating, setLocalRating] = useState<number>(lead?.rating ?? 0);
  const [localCardColor, setLocalCardColor] = useState<CardColor | null>(lead?.cardColor ?? null);
  const [localTags, setLocalTags] = useState<CrmTag[]>(lead?.tags ?? []);
  const tagWritePending = useRef(false);
  const contactWritePending = useRef<AbortController | null>(null);

  // Section-level edit mode flags (View Mode by default — zero "Click any field to edit in-place")
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [isEditingQualification, setIsEditingQualification] = useState(false);
  const [editingContactDraft, setEditingContactDraft] = useState<ContactDraft | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTab>("activities");
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const { runWrite, isPending, error: writeError, message: writeMessage } = useLeadQuickEditWrites(lead, branchId);
  const crmErrorText = useCrmErrorText();
  const displayedError = sectionError || crmErrorText(writeError) || writeMessage;
  const saveLead = useCallback(async (target: LeadItem, request: UpdateLeadRequest): Promise<boolean> => {
    setSectionError(null);
    const outcome = await runWrite(async () => {
      const outcome = await onSave(target, { ...request, expectedUpdatedAt: currentDetail?.updatedAt ?? target.updatedAt });
      if (outcome.kind === "success") {
        // The list callback reconciles its own rows; this modal owns a separate snapshot.
        try {
          const fresh = await fetchLeadDetail(target.id);
          setDetail((current) => current?.id === target.id ? fresh.lead : current);
        } catch (caught) {
          setDetail((current) => current?.id === target.id ? null : current);
          setDetailError(normalizeApiError(caught));
        }
      }
      return outcome;
    });
    return outcome?.kind === "success";
  }, [currentDetail, onSave, runWrite]);

  useEffect(() => {
    return () => {
      contactWritePending.current?.abort();
      contactWritePending.current = null;
    };
  }, [lead, branchId]);

  // Tag picker state
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);

  // Card 1 draft state (Corporate Company Details OR Individual Personal Details)
  const [companyNameDraft, setCompanyNameDraft] = useState("");
  const [companyEmailDraft, setCompanyEmailDraft] = useState("");
  const [companyEmailError, setCompanyEmailError] = useState<string | null>(null);
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

  const effectiveBranchId = currentDetail?.branchId || branchId || null;
  const { capabilities } = useLeadCapabilities(effectiveBranchId);
  const relatedCounts = useLeadRelatedCounts(
    lead?.id ?? null,
    currentDetail?.partyId ?? lead?.partyId ?? null,
    effectiveBranchId,
  );
  const customFieldValues = useCrmCustomFieldValues(
    effectiveBranchId,
    "LEAD",
    lead?.id ?? null,
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setDetail(null);
      setDetailError(null);
      setDetailRequest(lead ? { lead, branchId } : null);
      if (!lead) return;
      setLocalRating(lead.rating);
      setLocalCardColor(lead.cardColor);
      setLocalTags(lead.tags ?? []);
      setIsEditingIdentity(false);
      setIsEditingQualification(false);
      setEditingContactDraft(null);
      setSectionError(null);
    });
    if (!lead) return () => controller.abort();

    const load = async () => {
      try {
        const { lead: parsed } = await fetchLeadDetail(lead.id, controller.signal);
        if (controller.signal.aborted) return;
        setDetail(parsed);
      } catch (caught) {
        if (!controller.signal.aborted) setDetailError(normalizeApiError(caught));
      }
    };
    void load();
    return () => controller.abort();
  }, [lead, branchId, reloadToken]);

  const reloadDetail = useCallback(() => {
    setDetail(null);
    setDetailError(null);
    setReloadToken((current) => current + 1);
    onRefresh?.();
  }, [onRefresh]);

  const isConverted =
    currentDetail?.status === "CONVERTED" ||
    currentDetail?.stageFlag === "CONVERTED" ||
    Boolean(currentDetail?.convertedCustomerProfileId);
  const editable = currentDetail !== null && canUpdate && !isConverted;

  const canConvert =
    canMutate &&
    currentDetail !== null &&
    !isConverted &&
    crmCapabilityAllowsOwner(capabilities.convert, currentDetail.ownerUserId);

  const convertState = useLeadConvert(
    currentDetail,
    reloadDetail,
    canConvert,
    capabilities.opportunitiesCreate ?? null,
  );

  const fallbackDetail = currentDetail;

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
      queueMicrotask(() => {
        setLocalTags(references.tags);
      });
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
    setCompanyEmailError(null);
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
    setCustomFieldsDraft({});
    setIsEditingQualification(true);
  }, [fallbackDetail, editable]);

  // Save Card 1 (Corporate Company Details OR Individual Personal Info)
  const saveIdentitySection = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const isCorp = fallbackDetail.leadProfileType === "CORPORATE";
    const patch: UpdateLeadRequest = {};

    if (isCorp) {
      if (!companyNameDraft.trim()) {
        setSectionError(t.crmLeads.executive.companyNameRequired);
        return false;
      }
      const emailErrors = new CrmErrorBag({
        ...t.crmLeads.create.errors,
        url: t.crmShared.fieldUrl,
      });
      emailErrors.email("companyEmail", companyEmailDraft);
      const emailError = emailErrors.errors.companyEmail;
      setCompanyEmailError(emailError ?? null);
      if (emailError) return false;
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
        setSectionError(t.crmLeads.executive.personNameRequired);
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
        street2: apartmentDraft.trim() || undefined,
        landmark: landmarkDraft.trim() || undefined,
      };
    }

    setIsSavingSection(true);
    try {
      const cleanedPhones = phonesDraft.map((p) => p.trim()).filter(Boolean);
      if (Object.keys(patch).length > 0) {
        const ok = await saveLead(lead, patch);
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
    t,
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
    saveLead,
  ]);

  // Save Card 2 (Qualification, Ownership & Custom Fields)
  const saveQualificationSection = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editable) return false;
    setSectionError(null);
    const patch: UpdateLeadRequest = {};
    if (
      isUUIDv7(ownerUserIdDraft) &&
      ownerUserIdDraft !== (fallbackDetail.ownerUserId ?? "")
    ) {
      patch.ownerUserId = ownerUserIdDraft;
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
    if (customFieldValues.valuesLoaded && !customFieldValues.isLoading && !customFieldValues.error && !customFieldValues.valuesError) {
      const changedFields: Record<string, unknown> = {};
      for (const { definition, value } of customFieldValues.entries) {
        const key = definition.fieldKey;
        if (Object.prototype.hasOwnProperty.call(customFieldsDraft, key) && String(customFieldsDraft[key] ?? "") !== String(value?.value ?? "")) {
          changedFields[key] = customFieldsDraft[key];
        }
      }
      if (Object.keys(changedFields).length > 0) patch.customFields = changedFields;
    }

    setIsSavingSection(true);
    try {
      if (Object.keys(patch).length > 0) {
        const ok = await saveLead(lead, patch);
        if (!ok) return false;
      }
      const matchedSource = sources.find((s) => s.id === sourceIdDraft);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              ownerUserId: patch.ownerUserId ?? prev.ownerUserId,
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
      if (patch.customFields) {
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
    saveLead,
    sources,
    customFieldValues,
  ]);

  // Existing-person identity belongs to Core; CRM only owns the relationship.
  const saveContactPerson = useCallback(async (): Promise<boolean> => {
    if (!lead || !fallbackDetail || !editingContactDraft || !editable || contactWritePending.current) return false;
    setSectionError(null);
    const draft = editingContactDraft;
    const fullName = [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(" ");
    const messages = { ...t.crmLeads.create.errors, url: t.crmShared.fieldUrl, invalid: t.crmShared.errorValidation };
    const controller = new AbortController();
    contactWritePending.current = controller;
    setIsSavingSection(true);
    let completed = 0;
    let writing = false;
    let reconcile = false;
    let readback = false;
    let refusal: NormalizedApiError | null = null;
    const readLead = async () => {
      const { lead: fresh } = await fetchLeadDetail(lead.id, controller.signal);
      return fresh;
    };
    try {
      let fresh = await readLead();
      if (controller.signal.aborted) return false;
      if (fresh.leadProfileType !== "CORPORATE" || fresh.status === "CONVERTED") {
        setDetail(fresh);
        setEditingContactDraft(null);
        return false;
      }
      let body: UpdateLeadRequest;
      if (draft.partyId === null) {
        const newContact = { ...draft, displayName: fullName };
        const errors = validateNewLeadContact(newContact, messages);
        if (Object.keys(errors).length) { setSectionError(Object.values(errors)[0]); return false; }
        body = buildAddedContactLeadRequest(fresh, newContact);
      } else {
        const selected = fresh.contacts.find((contact) => contact.partyId === draft.partyId);
        const original = fallbackDetail.contacts.find((contact) => contact.partyId === draft.partyId);
        if (!selected || !original) throw new Error("Contact no longer belongs to this lead.");
        const baseline = contactModalForm(original);
        const form = { ...baseline, jobTitle: draft.jobTitle, isPrimary: draft.isPrimary };
        const firstChanged = draft.firstName !== (original.firstName ?? original.displayName.split(" ")[0] ?? "");
        const lastChanged = draft.lastName !== (original.lastName ?? original.displayName.split(" ").slice(1).join(" "));
        const phonesChanged = JSON.stringify(draft.phones.map((phone) => phone.trim()).filter(Boolean)) !== JSON.stringify(original.phones);
        const identityChanged = firstChanged || lastChanged || draft.honorificTitle !== baseline.honorificTitle || draft.email !== baseline.email || phonesChanged;
        if (identityChanged) {
          if (!CONTACT_DIRECTORY_PERMISSIONS.every((permission) => user?.permissions.includes(permission))) {
            setSectionError(t.crmLeadDetail.contactIdentityPermission);
            return false;
          }
          const person = parseContactPerson(await readCoreData(contactPersonPath(draft.partyId), {
            signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024,
          }), draft.partyId);
          if (controller.signal.aborted) return false;
          const identity = contactModalForm(selected, person);
          if (firstChanged) identity.firstName = draft.firstName;
          if (lastChanged) identity.lastName = draft.lastName;
          if (firstChanged || lastChanged) identity.displayName = fullName;
          if (draft.honorificTitle !== baseline.honorificTitle) identity.honorificTitle = draft.honorificTitle;
          if (draft.email !== baseline.email) identity.email = draft.email;
          if (phonesChanged) {
            // String-only quick-edit drafts must not overwrite methods changed since opening.
            if (JSON.stringify(identity.phones.map((phone) => phone.value)) !== JSON.stringify(original.phones)) {
              reconcile = true;
              throw new Error("Contact methods changed. Reload before editing.");
            }
            const available = [...identity.phones];
            const matched = draft.phones.map((value) => {
              const index = available.findIndex((phone) => phone.value === value.trim());
              return index < 0 ? null : available.splice(index, 1)[0];
            });
            identity.phones = draft.phones.map((value, index) => ({
              ...(matched[index] ?? available.shift() ?? { id: null, methodType: "MOBILE" as const, isPrimary: false }),
              value,
            }));
          }
          const errors = validateContactModal(identity, true, messages);
          if (Object.keys(errors).length) { setSectionError(Object.values(errors)[0]); return false; }
          for (const operation of buildContactCoreWrites(identity, person)) {
            writing = true;
            const receipt = await writeCoreData(operation.method, operation.path, operation.body, {
              nonReplayable: operation.method === "post", maxResponseBytes: 512 * 1024,
            });
            completed++;
            validateContactWriteResponse(operation, receipt, draft.partyId);
            writing = false;
            if (controller.signal.aborted) return false;
          }
        }
        fresh = await readLead();
        if (controller.signal.aborted) return false;
        body = buildSelectedContactLeadRequest(fresh, form, baseline);
      }
      if (Object.keys(body).length) {
        const outcome = await runIdempotentWrite({
          attempt: createWriteAttempt(), method: "patch", path: leadPath(lead.id), body: { ...body, expectedUpdatedAt: fresh.updatedAt },
          parse: (payload) => {
            const saved = parseLeadDetailResponse(payload);
            if (saved.id !== lead.id) throw new Error("Invalid lead response.");
            return saved;
          },
        });
        if (controller.signal.aborted) return false;
        if (outcome.kind !== "success") {
          reconcile = outcome.kind !== "failed";
          refusal = outcome.error;
          throw outcome.error;
        }
        completed++;
      }
      readback = true;
      fresh = await readLead();
      if (controller.signal.aborted) return false;
      setDetail(fresh);
      setEditingContactDraft(null);
      onRefresh?.();
      return true;
    } catch (caught) {
      if (controller.signal.aborted) return false;
      reconcile ||= completed > 0 || caught instanceof ContactWriteResponseError || (writing && isAmbiguousWriteFailure(caught));
      const partial = completed > 0 && !readback && !(caught instanceof ContactWriteResponseError);
      const message = refusal?.code === "CRM.LEAD.CONCURRENT_UPDATE"
        ? crmErrorText(refusal) ?? t.crmLeadDetail.contactReloadRequired
        : reconcile
        ? partial ? t.crmLeadDetail.contactPartialSave : t.crmLeadDetail.contactReloadRequired
        : t.crmLeadDetail.saveFailed;
      setSectionError(message);
      if (reconcile) {
        // Retire submitted drafts after uncertain/applied writes; Retry only reads.
        setEditingContactDraft(null);
        setDetail(null);
        setDetailError(normalizeApiError(caught));
        toast.error(message);
      }
      return false;
    } finally {
      if (contactWritePending.current === controller) {
        contactWritePending.current = null;
        setIsSavingSection(false);
      }
    }
  }, [lead, fallbackDetail, editingContactDraft, editable, user, t, toast, onRefresh, crmErrorText]);

  // Promote a corporate contact to primary directly
  const handleSetPrimaryContact = useCallback(
    async (targetPartyId: string) => {
      if (!lead || !fallbackDetail || !editable) return;
      const updated = fallbackDetail.contacts.map((c) => ({
        ...c,
        isPrimary: c.partyId === targetPartyId,
      }));
      const ok = await saveLead(lead, {
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
    [lead, fallbackDetail, editable, saveLead],
  );

  // Interactive 3-Star Rating toggle in Header
  const handleToggleRating = useCallback(
    async (starValue: number) => {
      if (!lead || !editable) return;
      const nextRating = localRating === starValue ? 0 : starValue;
      setSectionError(null);
      setLocalRating(nextRating);
      if (!await saveLead(lead, { rating: nextRating })) setLocalRating(localRating);
    },
    [lead, editable, localRating, saveLead],
  );

  // Interactive Board Card Color Picker in Header ("No color" first + 5 colors)
  const handleSelectCardColor = useCallback(
    async (color: CardColor | null) => {
      if (!lead || !editable) return;
      const nextColor = color === null ? null : localCardColor === color ? null : color;
      setSectionError(null);
      setLocalCardColor(nextColor);
      if (!await saveLead(lead, { cardColor: nextColor })) setLocalCardColor(localCardColor);
    },
    [lead, editable, localCardColor, saveLead],
  );

  const handleMoveStage = useCallback(async (stage: LeadStage) => {
    if (!lead || !currentDetail || !editable) return;
    const previous = { stageId: currentDetail.stageId, stageFlag: currentDetail.stageFlag };
    setSectionError(null);
    const outcome = await runWrite(() => {
      setDetail((current) => current ? { ...current, stageId: stage.id, stageFlag: stage.flag } : current);
      return onMoveStage({ ...lead, stageId: previous.stageId }, stage.id);
    });
    if (outcome && outcome.kind !== "success") {
      setDetail((current) => current ? { ...current, ...previous } : current);
    }
  }, [lead, currentDetail, editable, onMoveStage, runWrite]);

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
        .catch(() => toast.error(t.crmTags.loadFailed));
    }
  }, [editable, availableTags.length, t, toast]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!lead || !editable || tagWritePending.current) return;
      if (!isUUIDv7(lead.id) || !isUUIDv7(tag.id)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = localTags;
      if (previousTags.some((item) => item.id === tag.id)) return;
      tagWritePending.current = true;
      setLocalTags([...previousTags, tag]);
      setIsTagPickerOpen(false);
      try {
        const res = await axiosClient.post<unknown>(
          `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags`,
          { tagIds: [tag.id] },
          { skipAutoIdempotency: true },
        );
        if (!Array.isArray(res.data)) throw new Error("INVALID_CRM_TAGS_RESPONSE");
        setLocalTags(parseCrmTags(res.data));
      } catch {
        setLocalTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [lead, editable, localTags, t, toast],
  );

  const handleDetachTag = useCallback(
    async (tagId: string) => {
      if (!lead || !editable || tagWritePending.current) return;
      if (!isUUIDv7(lead.id) || !isUUIDv7(tagId)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = localTags;
      tagWritePending.current = true;
      setLocalTags(previousTags.filter((item) => item.id !== tagId));
      try {
        await axiosClient.delete(
          `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags/${encodeURIComponent(tagId)}`,
        );
      } catch {
        setLocalTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [lead, editable, localTags, t, toast],
  );

  // Save & Close [Ctrl+S] handler
  const handleSaveAndClose = useCallback(async () => {
    if (!lead || !editable || isPending) return;
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
    editable,
    isEditingIdentity,
    isEditingQualification,
    editingContactDraft,
    isPending,
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

  if (!lead) return null;
  if (!fallbackDetail) {
    return (
      <LeadQuickEditLoadState
        error={isCurrentDetail ? detailError : null}
        onRetry={reloadDetail}
        onClose={onClose}
      />
    );
  }

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
    t.crmLeads.executive.unassigned;

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
        className="dossier-backdrop fixed inset-0 z-(--z-modal) flex items-center justify-center p-3 sm:p-5"
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
                {leadNameInitials(fallbackDetail.displayName)}
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
                      ? t.crmLeads.executive.corporateLead
                      : t.crmLeads.executive.individualLead}
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
                    aria-label={t.crmLeads.executive.leadRating}
                  >
                    {CRM_RATING_STARS.map((starNum) => {
                      const active = starNum <= localRating;
                      return (
                        <Button
                          key={starNum}
                          type="button"
                          variant="ghost"
                          disabled={!editable || isPending}
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
                        </Button>
                      );
                    })}
                  </div>

                  {/* Interactive Board Card Color Picker Dots ("No Color" first + 5 colors) */}
                  <div
                    className="dossier-color-dots"
                    role="group"
                    aria-label={t.crmLeads.executive.cardColor}
                  >
                    {DOSSIER_HEADER_CARD_COLORS.map((opt) => {
                      const isNone = opt.color === null;
                      const isActive = localCardColor === opt.color;
                      return (
                        <Button
                          key={opt.color ?? "NONE"}
                          type="button"
                          variant="ghost"
                          disabled={!editable || isPending}
                          onClick={() => void handleSelectCardColor(opt.color)}
                          title={opt.color === null ? t.crmLeads.card.colorNone : t.crmLeads.card.colors[opt.color]}
                          aria-label={`${t.crmLeads.executive.cardColor}: ${opt.color === null ? t.crmLeads.card.colorNone : t.crmLeads.card.colors[opt.color]}`}
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
                        INTL_LOCALE[lang],
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </b>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Header KPI Counter Pills & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildLeadRelatedHref("opportunities", fallbackDetail.partyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.opportunities}
              >
                🚀 Opportunities <b>{relatedCounts.counts.opportunities ?? 0}</b>
              </Link>
              <Link
                href={buildLeadRelatedHref("quotations", fallbackDetail.partyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.quotations}
              >
                📄 Quotations <b>{relatedCounts.counts.quotations ?? 0}</b>
              </Link>
              <Link
                href={buildLeadRelatedHref("salesOrders", fallbackDetail.partyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.salesOrders}
              >
                📦 Orders <b>{relatedCounts.counts.salesOrders ?? 0}</b>
              </Link>
              <Link
                href={buildLeadRelatedHref("invoices", fallbackDetail.partyId)}
                onClick={() => onClose()}
                className={DOSSIER_KPI_PILL_CLASSES.invoices}
              >
                🧾 Invoices <b>{relatedCounts.counts.invoices ?? 0}</b>
              </Link>

              {isConverted && fallbackDetail.convertedCustomerProfileId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onClose();
                    router.push(
                      `/crm/customer-profiles/${fallbackDetail.convertedCustomerProfileId}`,
                    );
                  }}
                  className="dossier-btn dossier-btn-emerald"
                >
                  ✓ {t.crmLeads.executive.viewCustomerProfile}
                </Button>
              ) : canConvert ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => convertState.openModal()}
                  className="dossier-btn dossier-btn-primary"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>{t.crmLeads.executive.convertLead}</span>
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onClose();
                  router.push(`/crm/leads/${fallbackDetail.id}`);
                }}
                className="dossier-btn dossier-btn-outline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>{t.crmLeads.executive.openFullPage}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                aria-label="Close modal"
                className="dossier-close"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
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
                  <Button
                    key={st.id}
                    type="button"
                    variant="ghost"
                    disabled={!editable || isCurrent || isPending}
                    onClick={() => {
                      if (isTermConverted) {
                        if (canConvert) convertState.openModal();
                        return;
                      }
                      void handleMoveStage(st);
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
                        ? `● ${localizedName(st, lang)} (${t.crmLeads.executive.current})`
                        : localizedName(st, lang)}
                    </span>
                  </Button>
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
                  {t.crmLeads.executive.conversionSucceeded}
                </h4>
                <p>
                  {t.crmLeads.executive.conversionReadOnlyHint}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fallbackDetail.convertedCustomerProfileId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      router.push(
                        `/crm/customer-profiles/${fallbackDetail.convertedCustomerProfileId}`,
                      );
                    }}
                    className="dossier-btn dossier-btn-outline"
                  >
                    🏢 Customer Profile ↗
                  </Button>
                )}
                {fallbackDetail.convertedOpportunityId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      router.push(
                        `/crm/opportunities/${fallbackDetail.convertedOpportunityId}`,
                      );
                    }}
                    className="dossier-btn dossier-btn-emerald"
                  >
                    🚀 Opportunity ↗
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Section Validation / Write Error Alert */}
          {displayedError && (
            <div
              role="alert"
              className="mx-5 mt-3 rounded-sm border border-destructive/30 bg-destructive-subtle px-3.5 py-2 text-xs text-destructive-subtle-foreground"
            >
              {displayedError}
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
                          ? t.crmLeads.executive.editingCompany
                          : t.crmLeads.executive.companyDetails}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only (Converted)
                      </span>
                    ) : isEditingIdentity ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => {
                            setIsEditingIdentity(false);
                            setSectionError(null);
                          }}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {t.crmLeads.executive.cancel}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => void saveIdentitySection()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {t.crmLeads.executive.saveCompany}
                        </Button>
                      </div>
                    ) : (
                      editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={startIdentityEdit}
                          className="dossier-edit-btn"
                        >
                          ✏️ {t.crmLeads.executive.editCompany}
                        </Button>
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
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={startIdentityEdit}
                                className="dossier-edit-btn"
                              >
                                ✏️ {t.crmLeads.executive.editPhones}
                              </Button>
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
                                <LeadPhoneActionsRow
                                  showNumber={false}
                                  phone={ph}
                                  country={fallbackDetail.address?.country ?? lead.country}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {t.crmLeads.executive.noCompanyPhones}
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
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPhonesDraft((prev) => [...prev, ""])}
                                className="dossier-add-phone-btn"
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                                <span>{t.crmLeads.executive.addCompanyPhone}</span>
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
                              <Button
                                type="button"
                                variant="ghost"
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
                              </Button>
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
                              aria-invalid={companyEmailError ? true : undefined}
                              aria-describedby={companyEmailError ? "corp-company-email-error" : undefined}
                              value={companyEmailDraft}
                              onChange={(e) => {
                                setCompanyEmailDraft(e.target.value);
                                setCompanyEmailError(null);
                              }}
                            />
                            {companyEmailError && (
                              <p id="corp-company-email-error" className="text-sm text-destructive" role="alert">
                                {companyEmailError}
                              </p>
                            )}
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
                          ? t.crmLeads.executive.editingPersonalInfo
                          : t.crmLeads.executive.personalInfo}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only (Converted)
                      </span>
                    ) : isEditingIdentity ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => {
                            setIsEditingIdentity(false);
                            setSectionError(null);
                          }}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {t.crmLeads.executive.cancel}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => void saveIdentitySection()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {t.crmLeads.executive.savePersonalInfo}
                        </Button>
                      </div>
                    ) : (
                      editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={startIdentityEdit}
                          className="dossier-edit-btn"
                        >
                          ✏️ {t.crmLeads.executive.editPersonalInfo}
                        </Button>
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
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={startIdentityEdit}
                                className="dossier-edit-btn"
                              >
                                ✏️ {t.crmLeads.executive.editPhones}
                              </Button>
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
                                <LeadPhoneActionsRow
                                  showNumber={false}
                                  phone={ph}
                                  country={fallbackDetail.address?.country ?? lead.country}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {t.crmLeads.executive.noMobileNumbers}
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
                              <option value="">{t.crmLeads.executive.noTitle}</option>
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
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPhonesDraft((prev) => [...prev, ""])}
                                className="dossier-add-phone-btn"
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                                <span>{t.crmLeads.executive.addMobile}</span>
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
                              <Button
                                type="button"
                                variant="ghost"
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
                              </Button>
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
                        ? t.crmLeads.executive.editingQualification
                        : t.crmLeads.executive.qualificationDetails}
                    </span>
                  </div>
                  {isConverted ? (
                    <span className="dossier-badge dossier-badge-converted">
                      🔒 Read-Only (Converted)
                    </span>
                  ) : isEditingQualification ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isSavingSection || isPending}
                        onClick={() => {
                          setIsEditingQualification(false);
                          setSectionError(null);
                        }}
                        className="dossier-edit-btn dossier-cancel-btn"
                      >
                        ✕ {t.crmLeads.executive.cancel}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isSavingSection || isPending}
                        onClick={() => void saveQualificationSection()}
                        className="dossier-edit-btn dossier-save-btn"
                      >
                        ✓ {t.crmLeads.executive.saveQualification}
                      </Button>
                    </div>
                  ) : (
                    editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={startQualificationEdit}
                        className="dossier-edit-btn"
                      >
                        ✏️ {t.crmLeads.executive.editQualification}
                      </Button>
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
                              INTL_LOCALE[lang],
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
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      aria-label={`Remove tag ${tag.name}`}
                                      onClick={() => void handleDetachTag(tag.id)}
                                      className="ms-1 h-auto border-0 bg-transparent p-0 font-semibold opacity-75 hover:bg-transparent hover:opacity-100"
                                    >
                                      ×
                                    </Button>
                                  )}
                                </span>
                              );
                            })}
                            {editable && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={handleOpenTagPicker}
                                className="dossier-tag dossier-tag-add"
                              >
                                + {t.crmLeads.executive.attachTag}
                              </Button>
                            )}
                          </div>
                          {isTagPickerOpen && availableTags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/40 p-2">
                              {availableTags.map((tag) => (
                                <Button
                                  key={tag.id}
                                  type="button"
                                  variant="ghost"
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
                          <option value="" disabled>{t.crmLeadDetail.salesPerson}</option>
                          {fallbackDetail.ownerUserId &&
                            !references.ownerOptions.some((u) => u.id === fallbackDetail.ownerUserId) && (
                              <option value={fallbackDetail.ownerUserId}>{ownerDisplayName}</option>
                            )}
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
                          <option value="">{t.crmLeads.executive.noSource}</option>
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
                  {customFieldValues.valuesLoaded && !customFieldValues.isLoading && !customFieldValues.error && !customFieldValues.valuesError && customFieldValues.entries.length > 0 && (
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
                            ? t.crmLeads.executive.editingContact(editingContactDraft.firstName)
                            : t.crmLeads.executive.addingContact
                          : `${t.crmLeads.executive.contactPersons} (${fallbackDetail.contacts.length})`}
                      </span>
                    </div>
                    {isConverted ? (
                      <span className="dossier-badge dossier-badge-converted">
                        🔒 Read-Only
                      </span>
                    ) : editingContactDraft ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => setEditingContactDraft(null)}
                          className="dossier-edit-btn dossier-cancel-btn"
                        >
                          ✕ {t.crmLeads.executive.cancel}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSavingSection || isPending}
                          onClick={() => void saveContactPerson()}
                          className="dossier-edit-btn dossier-save-btn"
                        >
                          ✓ {t.crmLeads.executive.saveContact}
                        </Button>
                      </div>
                    ) : (
                      editable && (
                        <Button
                          type="button"
                          variant="ghost"
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
                          + {t.crmLeads.executive.addContact}
                        </Button>
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
                              <option value="">{t.crmLeads.executive.noTitle}</option>
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
                              disabled={isSavingSection || isPending}
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
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setEditingContactDraft((prev) =>
                                prev ? { ...prev, phones: [...prev.phones, ""] } : prev,
                              )
                            }
                            className="dossier-add-phone-btn"
                          >
                            + Add Number
                          </Button>
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
                            <Button
                              type="button"
                              variant="ghost"
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
                            </Button>
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
                                {leadNameInitials(ct.displayName)}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="dossier-contact-name">
                                    {ct.displayName}
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
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => void handleSetPrimaryContact(ct.partyId)}
                                    className="dossier-edit-btn"
                                  >
                                    ★ Set Primary
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
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
                                </Button>
                              </div>
                            )}
                          </div>

                          {ct.phones.map((ph, idx) => (
                            <div key={`${ph}-${idx}`} className="dossier-phone-item-view">
                              <span className="dossier-phone-num" dir="ltr">
                                📱 {formatPhoneDisplay(ph)}
                              </span>
                              <LeadPhoneActionsRow
                                showNumber={false}
                                phone={ph}
                                country={fallbackDetail.address?.country ?? lead.country}
                              />
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        {t.crmLeads.executive.noContacts}
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
                      variant="ghost"
                      role="tab"
                      aria-selected={activeDossierTab === "activities"}
                      onClick={() => setActiveDossierTab("activities")}
                      className={cn(
                        "dossier-tab",
                        activeDossierTab === "activities" && "active",
                      )}
                    >
                      📅 {t.crmLeads.executive.activities} (
                      {lead.nextActivity ? 1 : 0})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      role="tab"
                      aria-selected={activeDossierTab === "notes"}
                      onClick={() => setActiveDossierTab("notes")}
                      className={cn("dossier-tab", activeDossierTab === "notes" && "active")}
                    >
                      📝 {t.crmLeads.executive.notes}
                    </Button>
                    {canReadHistory && <Button
                      type="button"
                      variant="ghost"
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
                      variant="ghost"
                      role="tab"
                      aria-selected={activeDossierTab === "files"}
                      onClick={() => setActiveDossierTab("files")}
                      className={cn("dossier-tab", activeDossierTab === "files" && "active")}
                    >
                      📎 {t.crmLeads.executive.files}
                    </Button>
                  </div>

                  {activeDossierTab === "activities" && !isConverted && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenActivities(lead)}
                      className="dossier-edit-btn"
                    >
                      + {t.crmLeads.executive.bookActivity}
                    </Button>
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
                              {t.crmLeads.executive.nextFollowUp}
                            </span>
                            <span
                              className={cn(
                                "dossier-badge",
                                activityState === "OVERDUE"
                                  ? "bg-destructive-subtle text-destructive-subtle-foreground border-destructive/30"
                                  : "dossier-badge-stage",
                              )}
                            >
                              {activityState === "OVERDUE" ? "OVERDUE" : "SCHEDULED"} •{" "}
                              {new Date(lead.nextActivity.activityAt).toLocaleDateString(
                                INTL_LOCALE[lang],
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
                        <div className="rounded-lg border border-dashed border-border p-4 text-center">
                          <p className="text-xs font-semibold text-foreground">
                            {t.crmLeads.executive.noScheduledActivities}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t.crmLeads.executive.bookActivityHint}
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
                      readOnly={!canMutate || isConverted}
                    />
                  )}

                  {activeDossierTab === "history" && (
                    <RecordHistoryTab
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
                      readOnly={!canMutate || isConverted}
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
                Navigate Leads in Stage ({currentIndex >= 0 ? currentIndex + 1 : 1} of{" "}
                {Math.max(leads.length, 1)}):
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={!prevLead}
                onClick={() => prevLead && onNavigateLead(prevLead)}
                className="dossier-btn dossier-btn-outline disabled:opacity-40"
              >
                ← Prev Lead [J]
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!nextLead}
                onClick={() => nextLead && onNavigateLead(nextLead)}
                className="dossier-btn dossier-btn-outline disabled:opacity-40"
              >
                Next Lead [K] →
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {canDelete && onDeleteLead && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onClose();
                    onDeleteLead(lead);
                  }}
                  className="dossier-btn dossier-btn-danger"
                >
                  🗑️ {t.crmLeads.executive.deleteLead}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="dossier-btn dossier-btn-outline"
              >
                {t.crmLeads.executive.closeShortcut}
              </Button>
              {!isConverted && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSavingSection || isPending}
                  onClick={() => void handleSaveAndClose()}
                  className="dossier-btn dossier-btn-primary"
                >
                  ✓ {t.crmLeads.executive.saveCloseShortcut}
                </Button>
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
