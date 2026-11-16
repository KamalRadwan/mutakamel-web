import type { Language } from "@/i18n/useLanguage";
import type { TradePath } from "@/lib/api/envelope";
import { tradeGet } from "../trade-api";
import { tradeLocalizedName } from "../trade-validation";
import { parseUomsResponse, UOMS_PATH } from "../uoms/uom-contract";
import type { InventoryReferenceUom } from "./inventory-reference-contract";

/** Unit master is paginated; a name picker must not silently stop at its first page. */
export async function loadInventoryUnits(headers: Record<string, string>, lang: Language, signal?: AbortSignal): Promise<InventoryReferenceUom[]> {
  const units = new Map<string, InventoryReferenceUom>();
  for (let page = 1; ; page += 1) {
    if (signal?.aborted) return [];
    const response = await tradeGet(`${UOMS_PATH}?page=${page}&limit=100` as TradePath, { headers, signal, maxResponseBytes: 1_500_000 });
    const result = parseUomsResponse(response.data);
    for (const unit of result.items) units.set(unit.id, { id: unit.id, code: unit.code, name: tradeLocalizedName(unit.localizedNames, lang) || unit.displayName });
    if (result.items.length === 0 || page * result.limit >= result.total) return [...units.values()];
  }
}
