import { readCorePage } from "@/lib/api/envelope";
import {
  buildCoreListQuery, CORE_MAX_PAGE_LIMIT, invalidCoreResponse, parseCorePage,
  record, requiredBoolean, requiredText, requiredUuidV7,
} from "./core-page";

export interface CurrencyOption {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
}

// Core CurrenciesController / CurrencyResponseDto. Pickers need identity and
// names, not the exchange-rate and accounting fields of the settings editor.
function parseCurrencyOption(value: unknown): CurrencyOption {
  const row = record(value);
  if (!row || (row.status !== "ACTIVE" && row.status !== "INACTIVE")) invalidCoreResponse();
  const code = requiredText(row, "code", 3);
  if (!/^[A-Z]{3}$/.test(code)) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "id"), code,
    name: requiredText(row, "name", 80),
    isDefault: requiredBoolean(row, "isDefault"), status: row.status,
  };
}

export async function loadActiveCurrencyOptions(signal: AbortSignal): Promise<CurrencyOption[]> {
  const items: CurrencyOption[] = [];
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const query = buildCoreListQuery({
      page, limit: CORE_MAX_PAGE_LIMIT, search: "", sortBy: "name",
      filters: { status: "ACTIVE" },
    });
    const result = parseCorePage(await readCorePage("/api/tenant/core/v1/currencies", query, {
      signal, maxResponseBytes: 400_000, suppressForbiddenToast: true,
    }), parseCurrencyOption);
    items.push(...result.items.filter((item) => item.status === "ACTIVE"));
    if (!result.hasNext) return items;
    if (!result.items.length) invalidCoreResponse();
  }
}
