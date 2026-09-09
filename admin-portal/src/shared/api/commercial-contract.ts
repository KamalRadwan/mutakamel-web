import type { AxiosResponse } from "@/lib/api/axiosClient";
import type { NormalizedApiError } from "./normalized-api-error";

/** Closed transport readers. A new server field requires an explicit client review. */
export type Reader<T> = (value: unknown) => T;
export function contractFailure(): never { throw new Error("COMMERCIAL_RESPONSE_UNAVAILABLE"); }
export const text = (max = 512, pattern?: RegExp): Reader<string> => value => {
  if (typeof value !== "string" || value.length > max || (pattern && !pattern.test(value))) contractFailure();
  return value;
};
export const integer = (min = 0, max = Number.MAX_SAFE_INTEGER): Reader<number> => value => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) contractFailure();
  return value;
};
export const boolean: Reader<boolean> = value => typeof value === "boolean" ? value : contractFailure();
export const oneOf = <const T extends readonly (string | number | boolean | null)[]>(values: T): Reader<T[number]> => value =>
  values.includes(value as T[number]) ? value as T[number] : contractFailure();
export const nullable = <T>(read: Reader<T>): Reader<T | null> => value => value === null ? null : read(value);
export const optional = <T>(read: Reader<T>): Reader<T | undefined> => value => value === undefined ? undefined : read(value);
export const array = <T>(read: Reader<T>, max = 100): Reader<T[]> => value => {
  if (!Array.isArray(value) || value.length > max) contractFailure();
  return value.map(read);
};
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) contractFailure();
  return value as Record<string, unknown>;
}
export function object<S extends Record<string, Reader<unknown>>>(shape: S): Reader<{ [K in keyof S]: ReturnType<S[K]> }> {
  return value => {
    const source = record(value);
    if (Object.keys(source).some(key => !Object.hasOwn(shape, key))) contractFailure();
    const result: Record<string, unknown> = {};
    for (const [key, read] of Object.entries(shape)) {
      const parsed = read(source[key]);
      if (parsed !== undefined) result[key] = parsed;
    }
    return result as { [K in keyof S]: ReturnType<S[K]> };
  };
}
export const uuid = text(36, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const uuid7 = text(36, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const revision: Reader<string> = value => {
  const parsed = text(19, /^(?:0|[1-9][0-9]*)$/u)(value);
  return BigInt(parsed) <= BigInt("9223372036854775807") ? parsed : contractFailure();
};
export const positiveRevision: Reader<string> = value => { const parsed = revision(value); return parsed !== "0" ? parsed : contractFailure(); };
export const decimal = text(19, /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/u);
export const date: Reader<string> = value => {
  const parsed = text(35, /^\d{4}-\d{2}-\d{2}T/u)(value);
  return Number.isFinite(Date.parse(parsed)) ? parsed : contractFailure();
};
export const pagination = object({ page: integer(1, 1000000), limit: integer(1, 100), total: integer(), totalPages: integer(), hasNext: boolean, hasPrev: boolean });
export type CommercialPage<T> = { items: T[]; meta: ReturnType<typeof pagination> };

/** Opaque, bounded server-redacted JSON: not a business schema or executable UI. */
export const redactedRecord: Reader<Record<string, unknown>> = value => {
  const source = record(value);
  const visit = (node: unknown, depth: number): void => {
    if (depth > 10) contractFailure();
    if (node === null || typeof node === "string" || typeof node === "boolean" || (typeof node === "number" && Number.isFinite(node))) return;
    if (Array.isArray(node)) { if (node.length > 10000) contractFailure(); node.forEach(item => visit(item, depth + 1)); return; }
    Object.values(record(node)).forEach(item => visit(item, depth + 1));
  };
  visit(source, 0);
  if (new TextEncoder().encode(JSON.stringify(source)).length > 65536) contractFailure();
  return source;
};

export function readCommercialResponse<T>(response: AxiosResponse<unknown>, read: Reader<T>, paged = false, maxBytes = 1048576): T {
  let correlationId: string | undefined;
  try {
    const raw = record(response.data);
    if (typeof raw.correlationId === "string" && raw.correlationId.length <= 128) correlationId = raw.correlationId;
    if (new TextEncoder().encode(JSON.stringify(raw)).length > maxBytes) contractFailure();
    const envelope = object({ success: oneOf([true]), data: (value: unknown) => value, correlationId: text(128), timestamp: date,
      ...(paged ? { meta: pagination } : {}) })(raw);
    return read(paged ? { items: envelope.data, meta: raw.meta } : envelope.data);
  } catch {
    throw { isNormalized: true, httpStatus: 503, errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", errorCategory: "SERVER_ERROR",
      message: "Commercial response is unavailable or unsupported. Reload after the server/client contract is reconciled.", correlationId } satisfies NormalizedApiError;
  }
}
export function page<T>(read: Reader<T>): Reader<CommercialPage<T>> {
  const parse = object({ items: array(read), meta: pagination });
  return value => {
    const result = parse(value);
    const { meta } = result;
    if (result.items.length > meta.limit || result.items.length > meta.total || meta.totalPages !== Math.ceil(meta.total / meta.limit)
      || meta.hasNext !== (meta.page < meta.totalPages) || meta.hasPrev !== (meta.page > 1)) contractFailure();
    return result;
  };
}
