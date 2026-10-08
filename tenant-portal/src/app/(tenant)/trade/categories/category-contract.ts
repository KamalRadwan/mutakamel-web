import { z } from "zod";
import type { TradePath } from "@/lib/api/envelope";
import { isTimestamp, isUuidV7, parseTradePage } from "../trade-validation";

// Owning source: trade-app/packages/contracts/src/category.contracts.ts and
// common/src/constants/category-policy.ts (2026-09-27). Tree tokens are opaque.
export const CATEGORIES_PATH = "/api/tenant/trade/v1/categories" satisfies TradePath;
export const CATEGORY_OPTIONS_PATH = "/api/tenant/trade/v1/catalog/categories" satisfies TradePath;
export const CATEGORY_PAGE_SIZE = 50;
export const CATEGORY_RESPONSE_BYTES = 1_048_576;
export const CATEGORY_NODE_CACHE_LIMIT = 2_000;

const uuid = z.string().refine(isUuidV7);
const version = z.number().int().min(1).max(2_147_483_647);
const label = z.string().refine((value) => Array.from(value).length > 0 && Array.from(value).length <= 160);
const code = z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,79}$/u);
const timestamp = z.string().refine(isTimestamp);
const count = z.number().int().nonnegative();
const pathSegment = z.object({ id: uuid, code, name: label });
const managementSegment = pathSegment.extend({
  siblingPosition: z.number().int().min(1).max(1_000),
  siblingTotal: z.number().int().min(1).max(1_000),
}).refine((segment) => segment.siblingPosition <= segment.siblingTotal);
const path = z.array(pathSegment).min(1).max(8);
const uniquePath = (segments: readonly { id: string }[]) => new Set(segments.map((segment) => segment.id)).size === segments.length;
const localeNames = z.record(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u), label)
  .refine((names) => Object.keys(names).length >= 1 && Object.keys(names).length <= 20
    && new TextEncoder().encode(JSON.stringify(names)).byteLength <= 16_384);

const summaryShape = {
  id: uuid, code, name: label, displayName: label, parentId: uuid.nullable(),
  // A future own status stays renderable through the dictionary's unknown label.
  status: z.string().min(1).max(32), effectiveActive: z.boolean(), inactiveAncestorId: uuid.nullable(),
  sortOrder: z.number().int().nonnegative().max(2_147_483_647), depth: z.number().int().min(1).max(8),
  version, path: z.array(managementSegment).min(1).max(8), hasChildren: z.boolean(), childCount: count.max(1_000),
};
const summarySchema = z.object(summaryShape).refine(validSummary);
function validSummary(node: z.infer<z.ZodObject<typeof summaryShape>>): boolean {
  return uniquePath(node.path) && node.path.length === node.depth && node.path.at(-1)?.id === node.id
    && (node.path.at(-2)?.id ?? null) === node.parentId && node.hasChildren === (node.childCount > 0);
}

const detailSchema = z.object({ ...summaryShape, localizedNames: localeNames, treeVersion: version,
  subtreeHeight: z.number().int().min(1).max(8), createdAt: timestamp, updatedAt: timestamp,
  usage: z.object({ directItemCount: count, subtreeItemCount: count, descendantCount: count.max(9_999),
    hasRetainedItemReferences: z.boolean(), canDelete: z.boolean(),
    deleteBlockers: z.array(z.enum(["ACTIVE", "HAS_CHILDREN", "HAS_ITEM_REFERENCES"])).max(3), asOf: timestamp,
  }),
}).refine(validSummary).refine((node) => node.usage.canDelete === (node.usage.deleteBlockers.length === 0));

const optionSchema = z.object({ id: uuid, code, name: label, path, depth: z.number().int().min(1).max(8) })
  .refine((node) => uniquePath(node.path) && node.path.length === node.depth && node.path.at(-1)?.id === node.id);
const itemSummarySchema = z.object({ id: uuid, code, name: label, path, effectiveActive: z.boolean(), treeVersion: version })
  .refine((node) => uniquePath(node.path) && node.path.at(-1)?.id === node.id);
const mutationSchema = z.object({ id: uuid, version, treeVersion: version, changed: z.boolean() });
const deleteSchema = z.object({ id: uuid, deleted: z.literal(true), version, treeVersion: version, deletedAt: timestamp });

export type Category = z.infer<typeof summarySchema>;
export type CategoryDetail = z.infer<typeof detailSchema>;
export type CategoryOption = z.infer<typeof optionSchema>;
export type ItemCategorySummary = z.infer<typeof itemSummarySchema>;
export type CategoryReceipt = z.infer<typeof mutationSchema> | z.infer<typeof deleteSchema>;
export type CategoryStatus = "ACTIVE" | "INACTIVE";

function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item).max(100), total: count.max(10_000),
    page: z.number().int().min(1).max(10_000), limit: z.number().int().min(1).max(100),
    treeVersion: version, asOf: timestamp,
  }).refine((page) => page.items.length <= page.limit && (page.page - 1) * page.limit <= 9_999);
}

export function parseCategoryPage(value: unknown) {
  const page = pageSchema(summarySchema).parse(value);
  return { ...parseTradePage<Category>(page, (item) => summarySchema.parse(item), invalid), treeVersion: page.treeVersion, asOf: page.asOf };
}
export type CategoryPage = ReturnType<typeof parseCategoryPage>;

export function parseCategoryTreePage(value: unknown) {
  const { parentId } = z.object({ parentId: uuid.nullable() }).parse(value);
  const page = parseCategoryPage(value);
  if (page.items.some((node) => node.parentId !== parentId)) invalid();
  return { ...page, parentId };
}

export function parseCategoryOptions(value: unknown) {
  const page = pageSchema(optionSchema).parse(value);
  return { ...parseTradePage<CategoryOption>(page, (item) => optionSchema.parse(item), invalid), treeVersion: page.treeVersion, asOf: page.asOf };
}
export function parseCategoryDetail(value: unknown): CategoryDetail { return detailSchema.parse(value); }
export function parseItemCategorySummary(value: unknown): ItemCategorySummary | null { return itemSummarySchema.nullable().parse(value); }
export function parseCategoryReceipt(value: unknown): CategoryReceipt { return z.union([mutationSchema, deleteSchema]).parse(value); }
function invalid(): never { throw new Error("Invalid Category response."); }

export function categoryPath(id: string): TradePath {
  uuid.parse(id);
  return `${CATEGORIES_PATH}/${id}`;
}

export type CategoryIntent = { kind: "unresolved" } | { kind: "none" } | { kind: "selected"; id: string };

/** Loading state never changes intent. An unchanged edit omits the assignment. */
export function categoryAssignment(intent: CategoryIntent, original?: string | null): { categoryId?: string | null } {
  if (intent.kind === "unresolved") {
    if (original !== undefined) return {};
    throw new Error("Category choice is required.");
  }
  const categoryId = intent.kind === "none" ? null : uuid.parse(intent.id);
  return original !== undefined && categoryId === original ? {} : { categoryId };
}
