import type { TradePath } from "@/lib/api/envelope";
import {
  isNonEmptyString,
  isTradeDecimalString,
  isUuidV7,
  record,
} from "../trade-validation";
import { ITEMS_PATH } from "./item-contract";

const ITEM_REFERENCE_DATA_PATH = `${ITEMS_PATH}/reference-data` as TradePath;
const ITEM_REFERENCE_DATA_LIMIT = 50;

export function itemReferenceDataPath(search = ""): TradePath {
  const query = new URLSearchParams({
    search: search.trim().slice(0, 120),
    limit: String(ITEM_REFERENCE_DATA_LIMIT),
  });
  return `${ITEM_REFERENCE_DATA_PATH}?${query.toString()}` as TradePath;
}

interface ItemOwnerOption {
  id: string;
  name: string;
}

export interface ItemTaxOption {
  id: string;
  code: string;
  name: string;
  rate: string;
  isInclusive: boolean;
  companyId: string | null;
}

export interface ItemReferenceData {
  owners: ItemOwnerOption[];
  taxes: ItemTaxOption[];
  companyCurrencyCode: string | null;
}

export function parseItemReferenceData(payload: unknown): ItemReferenceData {
  const data = record(payload);
  if (!data || !Array.isArray(data.owners) || !Array.isArray(data.taxes)) invalidResponse();

  const owners = data.owners.map((candidate) => {
    const owner = record(candidate);
    if (!owner || !isUuidV7(owner.id) || !isNonEmptyString(owner.name, 255)) invalidResponse();
    return { id: owner.id, name: owner.name };
  });
  const taxes = data.taxes.map((candidate) => {
    const tax = record(candidate);
    if (
      !tax ||
      !isUuidV7(tax.id) ||
      !isNonEmptyString(tax.code, 80) ||
      !isNonEmptyString(tax.name, 160) ||
      !isTradeDecimalString(tax.rate) ||
      typeof tax.isInclusive !== "boolean" ||
      !Object.hasOwn(tax, "companyId") ||
      !(tax.companyId === null || isUuidV7(tax.companyId))
    ) {
      invalidResponse();
    }
    return {
      id: tax.id,
      code: tax.code,
      name: tax.name,
      rate: tax.rate,
      isInclusive: tax.isInclusive,
      companyId: tax.companyId as string | null,
    };
  });

  const companyCurrencyCode = data.companyCurrencyCode;
  if (
    companyCurrencyCode !== null &&
    companyCurrencyCode !== undefined &&
    (typeof companyCurrencyCode !== "string" || !/^[A-Z]{3}$/u.test(companyCurrencyCode))
  ) {
    invalidResponse();
  }
  return {
    owners,
    taxes,
    companyCurrencyCode: companyCurrencyCode ?? null,
  };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade item reference-data response.");
}
