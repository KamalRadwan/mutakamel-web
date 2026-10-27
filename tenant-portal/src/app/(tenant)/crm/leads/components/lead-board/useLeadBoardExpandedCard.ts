"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import type { LeadDetail } from "../../lead-contract";
import { fetchLeadDetail } from "../../lead-requests";
import { leadCardHeading } from "../../lead-card-contract";
import type { LeadItem } from "../../lead-list-contract";

export function useLeadBoardExpandedCard(lead: LeadItem, sources: readonly AcquisitionSource[]) {
  const { lang } = useI18n();
  const isCompany = lead.leadProfileType === "CORPORATE";
  const { title, contactName } = leadCardHeading(lead);
  const [detail, setDetail] = useState<LeadDetail | null>(null);

  // Fetch full lead detail on expand so corporate leads with multiple contacts
  // display up to 3 contacts and all stored phone numbers accurately.
  useEffect(() => {
    if (!isUUIDv7(lead.id)) return;
    const controller = new AbortController();
    fetchLeadDetail(lead.id, controller.signal)
      .then(({ lead: detail }) => {
        if (controller.signal.aborted) return;
        setDetail(detail);
      })
      .catch(() => {
        // Fallback to LeadItem summary data if detail endpoint fails
      });
    return () => controller.abort();
  }, [lead.id]);

  const matchedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          (lead.acquisitionSourceId && s.id === lead.acquisitionSourceId) ||
          (lead.sourceNameEn && s.nameEn === lead.sourceNameEn) ||
          (lead.sourceNameAr && s.nameAr === lead.sourceNameAr),
      ) ?? null,
    [lead.acquisitionSourceId, lead.sourceNameAr, lead.sourceNameEn, sources],
  );
  const sourceLabel =
    localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang) ||
    (matchedSource ? localizedName(matchedSource, lang) : "");
  const resolvedSourceIconUrl = lead.sourceIconUrl ?? matchedSource?.iconUrl ?? null;

  const individualPhones = useMemo(() => {
    const raw = [
      ...(detail?.phones ?? []),
      ...lead.phones,
      lead.primaryMobile,
      lead.phone,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.phones, lead.phone, lead.phones, lead.primaryMobile]);

  const corporateContacts = useMemo<
    ReadonlyArray<{
      partyId: string;
      displayName: string;
      jobTitle: string | null;
      isPrimary: boolean;
      phones: readonly string[];
    }>
  >(() => {
    if (detail && detail.contacts.length > 0) {
      return detail.contacts;
    }
    if (lead.primaryContact) {
      return [lead.primaryContact];
    }
    const fallbackName = contactName || "";
    const fallbackPhone = lead.primaryMobile || lead.phone || lead.phones[0] || "";
    if (fallbackName || fallbackPhone) {
      return [
        {
          partyId: "",
          displayName: fallbackName || title,
          jobTitle: "",
          isPrimary: true,
          phones: fallbackPhone ? [fallbackPhone] : [],
        },
      ];
    }
    return [];
  }, [
    contactName,
    detail,
    lead.phone,
    lead.phones,
    lead.primaryContact,
    lead.primaryMobile,
    title,
  ]);

  const companyPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      detail?.companyPhone,
      ...(detail?.phones ?? []),
      lead.phone,
      ...lead.phones,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.companyPhone, detail?.phones, isCompany, lead.phone, lead.phones]);

  const hasMultipleCorporateContacts = isCompany && corporateContacts.length > 1;
  const singleCorporateContact = isCompany ? (corporateContacts[0] ?? null) : null;
  const singleCorporateContactPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      ...(singleCorporateContact?.phones ?? []),
      ...(lead.primaryContact?.phones ?? []),
      lead.primaryMobile,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [
    isCompany,
    lead.primaryContact?.phones,
    lead.primaryMobile,
    singleCorporateContact?.phones,
  ]);

  const ownerFullName = lead.owner
    ? [lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")
    : "";
  return {
    isCompany, title, contactName, sourceLabel, resolvedSourceIconUrl,
    individualPhones, companyPhones, hasMultipleCorporateContacts, corporateContacts,
    singleCorporateContact, singleCorporateContactPhones, ownerFullName
  };
}
