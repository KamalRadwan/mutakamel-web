import type { TradePath } from "@/lib/api/envelope";
import { isRowVersion, isUuidV7, record } from "../trade-validation";
import { isItemDecimalString, itemPath } from "./item-contract";

export const STANDARD_COST_VIEW_PERMISSION = "trade.pricing.view_cost";
export const STANDARD_COST_MANAGE_PERMISSION = "trade.pricing.manage";

export interface ItemStandardCost {
  itemId: string;
  companyProfileId: string;
  standardCost: string | null;
  currencyCode: string | null;
  version: number;
}

export function itemStandardCostPath(itemId: string): TradePath {
  return `${itemPath(itemId)}/standard-cost` as TradePath;
}

export function buildStandardCostRequest(raw: string, currencyCode: string | null) {
  const standardCost = raw.trim();
  if (standardCost && !isItemDecimalString(standardCost)) {
    throw new Error("STANDARD_COST_FORM_VALUE");
  }
  if (standardCost && !currencyCode) throw new Error("STANDARD_COST_CURRENCY_REQUIRED");
  return { standardCost: standardCost || null };
}

export function parseStandardCostResponse(payload: unknown): ItemStandardCost {
  const cost = record(payload);
  if (
    !cost ||
    !isUuidV7(cost.itemId) ||
    !isUuidV7(cost.companyProfileId) ||
    !(cost.standardCost == null || isItemDecimalString(cost.standardCost)) ||
    !(
      cost.currencyCode == null ||
      (typeof cost.currencyCode === "string" && /^[A-Z]{3}$/u.test(cost.currencyCode))
    ) ||
    !isRowVersion(cost.version)
  ) {
    throw new Error("Invalid Trade item standard-cost response.");
  }
  return {
    itemId: cost.itemId,
    companyProfileId: cost.companyProfileId,
    standardCost: (cost.standardCost as string | null | undefined) ?? null,
    currencyCode: typeof cost.currencyCode === "string" ? cost.currencyCode : null,
    version: cost.version,
  };
}
