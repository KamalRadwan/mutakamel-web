import { z } from "zod";

// Core tenant/application-access/application-access-list.contract.ts and its installed envelope.
export const accessPagination = { page: z.number().int().min(1).max(1_000_000), limit: z.number().int().min(1).max(100) };
const metadata = z.object({ ...accessPagination, total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  totalPages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), hasNext: z.boolean(), hasPrev: z.boolean() }).strict();

export function accessPageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({ success: z.literal(true), data: z.array(item).max(100), meta: metadata,
    correlationId: z.string().max(36), timestamp: z.iso.datetime().max(30) }).strict();
}

export function matchesAccessPagination(meta: z.infer<typeof metadata>, count: number, request: { page: number; limit: number }): boolean {
  return meta.page === request.page && meta.limit === request.limit && meta.totalPages === Math.ceil(meta.total / meta.limit)
    && meta.hasNext === (meta.page < meta.totalPages) && meta.hasPrev === (meta.page > 1)
    && count === Math.max(0, Math.min(meta.limit, meta.total - (meta.page - 1) * meta.limit));
}
