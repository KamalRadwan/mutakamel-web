"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { parseCustomerProfileDetailResponse, type CustomerProfileDetail } from "../../customer-profile-contract";
import { customerProfilePath, type CustomerProfileItem } from "../../hooks/useCustomerProfiles";
export function useCustomerBoardDetail(item: CustomerProfileItem, sources: readonly AcquisitionSource[]) {
  const { lang } = useI18n();
  const isCompany = item.profileType === "CORPORATE";
  const title = isCompany ? item.companyName || item.displayName : item.displayName;
  const contactName = (item.primaryContactName ?? "").trim();
  const [loaded, setLoaded] = useState<{ id: string; detail: CustomerProfileDetail } | null>(null);
  const detail = loaded?.id === item.id ? loaded.detail : null;
  useEffect(() => {
    if (!isUUIDv7(item.id)) return;
    const controller = new AbortController();
    axiosClient
      .get(customerProfilePath(item.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        setLoaded({ id: item.id, detail: parseCustomerProfileDetailResponse(res.data) });
      })
      .catch(() => {
        // Expanded cards remain a read-only view of the admitted summary when detail is unavailable.
      });
    return () => controller.abort();
  }, [item.id]);
  const matchedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          (detail?.acquisitionSourceId &&
            s.id === detail.acquisitionSourceId) ||
          (item.acquisitionSourceNameEn &&
            s.nameEn === item.acquisitionSourceNameEn) ||
          (item.acquisitionSourceNameAr &&
            s.nameAr === item.acquisitionSourceNameAr),
      ) ?? null,
    [
      detail,
      item.acquisitionSourceNameAr,
      item.acquisitionSourceNameEn,
      sources,
    ],
  );
  const sourceLabel =
    localizedValue(
      item.acquisitionSourceNameAr ?? detail?.acquisitionSourceNameAr,
      item.acquisitionSourceNameEn ?? detail?.acquisitionSourceNameEn,
      lang,
    ) || (matchedSource ? localizedName(matchedSource, lang) : "");
  const resolvedSourceIconUrl =
    item.sourceIconUrl ?? matchedSource?.iconUrl ?? null;
  const individualPhones = useMemo(() => {
    const raw = [
      ...(detail?.phones ?? []),
      ...item.phones,
      detail?.primaryMobile,
      item.phone,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.phones, detail?.primaryMobile, item.phone, item.phones]);
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
    if (item.primaryContact) {
      return [item.primaryContact];
    }
    const fallbackName = contactName || item.primaryContactName || "";
    const fallbackPhone = item.phone || item.phones[0] || "";
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
    item.phone,
    item.phones,
    item.primaryContact,
    item.primaryContactName,
    title,
  ]);
  const companyPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      detail?.companyPhone,
      ...(detail?.phones ?? []),
      item.phone,
      ...item.phones,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.companyPhone, detail?.phones, isCompany, item.phone, item.phones]);
  const hasMultipleCorporateContacts =
    isCompany && corporateContacts.length > 1;
  const singleCorporateContact = isCompany
    ? (corporateContacts[0] ?? null)
    : null;
  const singleCorporateContactPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      ...(singleCorporateContact?.phones ?? []),
      ...(item.primaryContact?.phones ?? []),
      detail?.primaryMobile,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [
    detail?.primaryMobile,
    isCompany,
    item.primaryContact?.phones,
    singleCorporateContact?.phones,
  ]);

  return { isCompany, title, contactName, individualPhones, companyPhones, corporateContacts,
    hasMultipleCorporateContacts, singleCorporateContact, singleCorporateContactPhones,
    sourceLabel, resolvedSourceIconUrl };
}
