import type { TradePath } from "@/lib/api/envelope";
import { generateUUIDv7 } from "@/lib/uuid";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePatch, tradePost } from "../trade-api";
import {
  CATEGORIES_PATH, CATEGORY_OPTIONS_PATH, CATEGORY_PAGE_SIZE, CATEGORY_RESPONSE_BYTES,
  categoryPath, parseCategoryDetail, parseCategoryOptions, parseCategoryPage, parseCategoryReceipt, parseCategoryTreePage,
  type CategoryStatus,
} from "./category-contract";

interface PageQuery { page?: number; limit?: number; locale: string }
interface CategorySearch extends PageQuery {
  search?: string; parentId?: string | "ROOT"; ancestorId?: string; moveSourceId?: string; status?: CategoryStatus;
}

function queryPath(base: TradePath, query: object): TradePath {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return `${base}?${params.toString()}`;
}

export async function readCategoryTree(parentId: string | null, page: number, locale: string, signal?: AbortSignal) {
  const response = await tradeGet(queryPath(`${CATEGORIES_PATH}/tree`, {
    parentId: parentId ?? undefined, page, limit: CATEGORY_PAGE_SIZE, locale,
  }), { signal, headers: {}, maxResponseBytes: CATEGORY_RESPONSE_BYTES });
  const result = parseCategoryTreePage(response.data);
  if (result.parentId !== parentId || result.page !== page || result.limit !== CATEGORY_PAGE_SIZE) throw new Error("Unexpected Category page.");
  return result;
}

export async function readCategories(query: CategorySearch, signal?: AbortSignal) {
  const body = { ...query, page: query.page ?? 1, limit: query.limit ?? CATEGORY_PAGE_SIZE };
  const hasSearch = Boolean(query.search || query.ancestorId || query.moveSourceId);
  const result = hasSearch
    ? await tradePost(`${CATEGORIES_PATH}/search`, body, {
      signal, headers: {}, skipAutoIdempotency: true, maxResponseBytes: CATEGORY_RESPONSE_BYTES,
    })
    : await tradeGet(queryPath(CATEGORIES_PATH, body), { signal, headers: {}, maxResponseBytes: CATEGORY_RESPONSE_BYTES });
  const page = parseCategoryPage(result.data);
  if (page.page !== body.page || page.limit !== body.limit) throw new Error("Unexpected Category page.");
  return page;
}

export async function readCategory(id: string, locale: string, signal?: AbortSignal) {
  const result = await tradeGet(queryPath(categoryPath(id), { locale }), {
    signal, headers: {}, maxResponseBytes: CATEGORY_RESPONSE_BYTES,
  });
  const detail = parseCategoryDetail(result.data);
  if (detail.id !== id) throw new Error("Unexpected Category detail.");
  return detail;
}

export async function readCategoryOptions(query: PageQuery & { search?: string }, headers: Record<string, string>, signal?: AbortSignal) {
  const request = { ...query, page: query.page ?? 1, limit: query.limit ?? CATEGORY_PAGE_SIZE };
  const result = await tradeGet(queryPath(CATEGORY_OPTIONS_PATH, request), { signal, headers, maxResponseBytes: CATEGORY_RESPONSE_BYTES });
  const page = parseCategoryOptions(result.data);
  if (page.page !== request.page || page.limit !== request.limit) throw new Error("Unexpected Category options.");
  return page;
}

type Structural = { expectedTreeVersion: number };
type Names = { displayName: string; localizedNames: Record<string, string> };
type Existing = { id: string; version: number };
export type CategoryCommand =
  | { action: "create"; body: Structural & Names & { code: string; parentId: string | null; beforeId?: string | null } }
  | (Existing & { action: "update"; body: Partial<Names> })
  | (Existing & { action: "move"; body: Structural & { parentId: string | null; beforeId?: string | null } })
  | (Existing & { action: "reorder"; body: Structural & { beforeId: string | null } })
  | (Existing & { action: "status"; body: Structural & { status: CategoryStatus; reason: string } })
  | (Existing & { action: "delete"; body: Structural & { reason: string } });

export interface CategorySubmission {
  readonly key: string;
  readonly path: TradePath;
  readonly method: "PATCH" | "POST";
  readonly body: string;
  readonly ifMatch?: string;
  readonly targetId?: string;
  readonly deletion: boolean;
}

/** Preserve original parsed intent; normalization belongs to the server. */
export function captureCategorySubmission(command: CategoryCommand): CategorySubmission {
  const existing = command.action !== "create";
  const base = existing ? categoryPath(command.id) : CATEGORIES_PATH;
  return Object.freeze({
    key: generateUUIDv7(), method: command.action === "update" ? "PATCH" : "POST",
    path: !existing || command.action === "update" ? base : `${base}/${command.action}` as TradePath,
    body: JSON.stringify(command.body), ifMatch: existing ? tradeIfMatch(command.version) : undefined,
    targetId: existing ? command.id : undefined, deletion: command.action === "delete",
  });
}

export async function submitCategory(submission: CategorySubmission) {
  const headers: Record<string, string> = { "x-idempotency-key": submission.key };
  if (submission.ifMatch) headers["if-match"] = submission.ifMatch;
  const result = await (submission.method === "PATCH" ? tradePatch : tradePost)(
    submission.path, JSON.parse(submission.body) as unknown,
    { headers, nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 16_384 },
  );
  const receipt = parseCategoryReceipt(result.data);
  if ((submission.targetId && receipt.id !== submission.targetId) || submission.deletion !== ("deleted" in receipt)) {
    throw new Error("Unexpected Category receipt.");
  }
  return { receipt, replayed: isTradeReplay(result.headers) };
}
