import { isUUIDv7 } from "@/lib/uuid";
import { canonicalizeDecimalInput } from "./fixed-decimal";

export const TRADE_DOCUMENT_MAX_LINES = 1_000;

// CommercialLineInputDto: positive numeric(24,8), independent of price preview.
const QUANTITY = /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;

export interface TradeLineInputErrors {
  item?: "ITEM_REQUIRED";
  uom?: "UOM_REQUIRED";
  quantity?: "QUANTITY_INVALID";
}

export function canonicalTradeQuantity(input: string): string | null {
  if (input.trim().length > 40) return null;
  const value = canonicalizeDecimalInput(input);
  return value !== null && QUANTITY.test(value) ? value : null;
}

export function validateTradeLine(input: {
  itemId: string;
  uomId: string;
  quantity: string;
}): TradeLineInputErrors {
  return {
    ...(!isUUIDv7(input.itemId) ? { item: "ITEM_REQUIRED" as const } : {}),
    ...(!isUUIDv7(input.uomId) ? { uom: "UOM_REQUIRED" as const } : {}),
    ...(canonicalTradeQuantity(input.quantity) === null
      ? { quantity: "QUANTITY_INVALID" as const }
      : {}),
  };
}
