import { parseItemDetailResponse, parseItemResponse } from "../items/item-contract";
import { parseCompanyProfileResponse } from "../items/item-profile-contract";
import { tradeLocalizedName, record } from "../trade-validation";
import type { Language } from "@/i18n/useLanguage";

export interface InventoryReferenceItem {
  id: string;
  name: string;
  code: string;
  profileId: string | null;
  profileVersion: number | null;
  baseUomId: string;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  trackingMode: "NONE" | "LOT" | "SERIAL" | null;
  trackInventory: boolean | null;
}

export interface InventoryReferenceUom { id: string; name: string; code: string }

/** Item list eligibility supplies identity; tracking is proved only by item detail. */
export function parseInventoryReferenceItem(payload: unknown, lang: Language, detail = false): InventoryReferenceItem {
  const item = detail ? parseItemDetailResponse(payload) : parseItemResponse(payload);
  const row = record(payload);
  const profile = detail && row?.companyProfile ? parseCompanyProfileResponse(row.companyProfile) : null;
  const mode = profile?.trackingMode;
  return {
    id: item.id,
    name: tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode,
    code: item.canonicalCode,
    profileId: profile?.id ?? item.eligibility?.companyProfileId ?? null,
    profileVersion: profile?.version ?? item.eligibility?.companyProfileVersion ?? null,
    baseUomId: item.baseUomId,
    defaultSalesUomId: profile?.defaultSalesUomId ?? item.eligibility?.defaultSalesUomId ?? null,
    defaultPurchaseUomId: profile?.defaultPurchaseUomId ?? item.eligibility?.defaultPurchaseUomId ?? null,
    trackingMode: mode === "NONE" || mode === "LOT" || mode === "SERIAL" ? mode : null,
    trackInventory: profile?.trackInventory ?? null,
  };
}
