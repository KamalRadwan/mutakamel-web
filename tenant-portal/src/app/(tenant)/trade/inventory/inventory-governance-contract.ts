import type { TradePath } from "@/lib/api/envelope";
import {
  INVENTORY_CODE_PATTERN,
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isOptionalText,
  isTimestamp,
  isUuidV7,
  record,
} from "../trade-advanced-validation";
import { REASON_CODE_MAX_LENGTH, invalidResponse } from "./inventory-contract";

// Inventory governance — periods, UOM conversions, serials and decisions.
// All four are COMPANY-scoped reads with the **limit-only** dialect: no
// `page`, and the response is a BARE ARRAY (TypeORM `getMany()`), so there is
// no `total` and "is there more?" cannot be answered. Sending `page` is a 400,
// because the global pipe runs `forbidNonWhitelisted`.
//
// Source: trade-app/src/modules/inventory/inventory-governance.service.ts and
// dto/inventory.dto.ts; entities in
// packages/database/src/entities/tenant/inventory.entities.ts.

export const INVENTORY_PERIODS_PATH = "/api/tenant/trade/v1/inventory/periods";
export const INVENTORY_UOM_CONVERSIONS_PATH =
  "/api/tenant/trade/v1/inventory/uom-conversions";
const INVENTORY_SERIALS_PATH = "/api/tenant/trade/v1/inventory/serials";
const INVENTORY_DECISIONS_PATH = "/api/tenant/trade/v1/inventory/decisions";

/** `@Max(100)` on every limit-only query DTO; the DTO default is 50. */
export const INVENTORY_LIST_LIMIT = 50;

export const PERIOD_STATUSES = ["OPEN", "CLOSED"] as const;
export const UOM_CONVERSION_STATUSES = ["DRAFT", "PUBLISHED", "RETIRED"] as const;
export const SERIAL_STATES = ["ON_HAND", "RESERVED", "DELIVERED", "VOIDED"] as const;
export const INVENTORY_POLICY_KINDS = [
  "INVENTORY_RESERVATION",
  "INVENTORY_NEGATIVE",
  "INVENTORY_OVER_RECEIPT",
] as const;

export type PeriodStatus = (typeof PERIOD_STATUSES)[number];
export type UomConversionStatus = (typeof UOM_CONVERSION_STATUSES)[number];
export type SerialState = (typeof SERIAL_STATES)[number];
export type InventoryPolicyKind = (typeof INVENTORY_POLICY_KINDS)[number];

export interface InventoryPeriod {
  id: string;
  code: string;
  startsOn: string;
  endsOn: string;
  status: string;
  maxBackdateDays: number;
  closedAt: string | null;
  closeReason: string | null;
  version: number;
}

export interface InventoryUomConversion {
  id: string;
  itemCompanyProfileId: string;
  fromUomId: string;
  toUomId: string;
  revisionNumber: number;
  /** `bigint` columns — exact integer strings, never `Number()`d. */
  factorNumerator: string;
  factorDenominator: string;
  status: string;
  effectiveFrom: string;
  version: number;
}

export interface InventorySerial {
  id: string;
  itemId: string;
  itemCompanyProfileId: string;
  serialKey: string;
  state: string;
  currentFulfillmentNodeId: string | null;
  lastTransitionAt: string;
  version: number;
}

interface InventorySerialLifecycleEntry {
  id: string;
  eventType: string;
  occurredAt: string;
}

export interface InventorySerialDetail extends InventorySerial {
  lifecycle: InventorySerialLifecycleEntry[];
}

/**
 * `safeInventoryDecision` projects the receipt down to these fields before it
 * leaves the service — the raw `result` object is not sent, only `outcome`,
 * `selectedValue` and `explanationCode`.
 */
export interface InventoryDecision {
  id: string;
  decisionType: string;
  aggregateType: string;
  aggregateId: string;
  outcome: string | null;
  explanationCode: string | null;
  explanation: string | null;
  evaluatedAt: string;
  correlationId: string | null;
}

export interface PeriodFormValues {
  code: string;
  startsOn: string;
  endsOn: string;
  maxBackdateDays: string;
}

export const EMPTY_PERIOD_FORM: PeriodFormValues = {
  code: "",
  startsOn: "",
  endsOn: "",
  maxBackdateDays: "0",
};

export interface UomConversionFormValues {
  itemCompanyProfileId: string;
  fromUomId: string;
  toUomId: string;
  factorNumerator: string;
  factorDenominator: string;
  effectiveFrom: string;
}

export const EMPTY_UOM_CONVERSION_FORM: UomConversionFormValues = {
  itemCompanyProfileId: "",
  fromUomId: "",
  toUomId: "",
  factorNumerator: "1",
  factorDenominator: "1",
  effectiveFrom: "",
};

function limitQuery(extra: Record<string, string | undefined>): string {
  const query = new URLSearchParams({ limit: String(INVENTORY_LIST_LIMIT) });
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

export function periodsListPath(status?: PeriodStatus): TradePath {
  return `${INVENTORY_PERIODS_PATH}?${limitQuery({ status })}` as TradePath;
}

export function periodActionPath(id: string, action: "close" | "reopen"): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${INVENTORY_PERIODS_PATH}/${encodeURIComponent(id)}/${action}` as TradePath;
}

export function uomConversionsListPath(status?: UomConversionStatus): TradePath {
  return `${INVENTORY_UOM_CONVERSIONS_PATH}?${limitQuery({ status })}` as TradePath;
}

export function uomConversionActionPath(id: string, action: "publish" | "retire"): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${INVENTORY_UOM_CONVERSIONS_PATH}/${encodeURIComponent(id)}/${action}` as TradePath;
}

export function serialsListPath(state?: SerialState, serialKey?: string): TradePath {
  return `${INVENTORY_SERIALS_PATH}?${limitQuery({ state, serialKey })}` as TradePath;
}

export function serialPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${INVENTORY_SERIALS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function inventoryDecisionsListPath(policyKind?: InventoryPolicyKind): TradePath {
  return `${INVENTORY_DECISIONS_PATH}?${limitQuery({ policyKind })}` as TradePath;
}

export function inventoryDecisionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${INVENTORY_DECISIONS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

/** `InventoryPeriodTransitionDto.reasonCode` is a **code**, not free text. */
export function buildReasonCode(raw: string): { reasonCode: string } {
  const reasonCode = raw.trim().toUpperCase();
  if (!INVENTORY_CODE_PATTERN.test(reasonCode) || reasonCode.length > REASON_CODE_MAX_LENGTH) {
    throw new Error("INVENTORY_FORM_REASON");
  }
  return { reasonCode };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
/** `^[1-9]\d{0,17}$` — positive integers as strings, never decimals. */
const POSITIVE_INTEGER_STRING = /^[1-9]\d{0,17}$/u;

export function buildCreatePeriodRequest(values: PeriodFormValues): {
  code: string;
  startsOn: string;
  endsOn: string;
  maxBackdateDays: number;
} {
  const code = values.code.trim().toUpperCase();
  if (!INVENTORY_CODE_PATTERN.test(code)) throw new Error("INVENTORY_FORM_CODE");
  // `startsOn`/`endsOn` are `YYYY-MM-DD`, NOT ISO date-times — an ISO string
  // here is a 400 from the pipe.
  if (!ISO_DATE.test(values.startsOn) || !ISO_DATE.test(values.endsOn)) {
    throw new Error("INVENTORY_FORM_DATE");
  }
  if (values.endsOn < values.startsOn) throw new Error("INVENTORY_FORM_DATE");
  const maxBackdateDays = Number(values.maxBackdateDays.trim());
  if (!Number.isSafeInteger(maxBackdateDays) || maxBackdateDays < 0 || maxBackdateDays > 366) {
    throw new Error("INVENTORY_FORM_BACKDATE");
  }
  return { code, startsOn: values.startsOn, endsOn: values.endsOn, maxBackdateDays };
}

export function buildCreateUomConversionRequest(values: UomConversionFormValues): {
  itemCompanyProfileId: string;
  fromUomId: string;
  toUomId: string;
  factorNumerator: string;
  factorDenominator: string;
  effectiveFrom: string;
} {
  const ids = [values.itemCompanyProfileId, values.fromUomId, values.toUomId].map((entry) =>
    entry.trim(),
  );
  if (!ids.every(isUuidV7)) throw new Error("INVENTORY_FORM_UOM");
  if (ids[1] === ids[2]) throw new Error("INVENTORY_FORM_UOM");
  const numerator = values.factorNumerator.trim();
  const denominator = values.factorDenominator.trim();
  if (!POSITIVE_INTEGER_STRING.test(numerator) || !POSITIVE_INTEGER_STRING.test(denominator)) {
    throw new Error("INVENTORY_FORM_FACTOR");
  }
  const effectiveFrom = values.effectiveFrom.trim();
  if (!isTimestamp(effectiveFrom)) throw new Error("INVENTORY_FORM_DATE");
  return {
    itemCompanyProfileId: ids[0],
    fromUomId: ids[1],
    toUomId: ids[2],
    factorNumerator: numerator,
    factorDenominator: denominator,
    effectiveFrom: new Date(effectiveFrom).toISOString(),
  };
}

export function parseInventoryPeriod(payload: unknown): InventoryPeriod {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 40) ||
    !isNonEmptyString(row.startsOn, 32) ||
    !isNonEmptyString(row.endsOn, 32) ||
    !isNonEmptyString(row.status, 12) ||
    !isBoundedInteger(row.maxBackdateDays, 0, 366) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isOptionalText(row.closeReason, 240)
  ) {
    invalidResponse();
  }
  return {
    id: row.id,
    code: row.code,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    maxBackdateDays: row.maxBackdateDays,
    closedAt: isTimestamp(row.closedAt) ? row.closedAt : null,
    closeReason: (row.closeReason as string | null | undefined) ?? null,
    version: row.version,
  };
}

export function parseInventoryUomConversion(payload: unknown): InventoryUomConversion {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.itemCompanyProfileId) ||
    !isUuidV7(row.fromUomId) ||
    !isUuidV7(row.toUomId) ||
    !isBoundedInteger(row.revisionNumber, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.factorNumerator, 20) ||
    !isNonEmptyString(row.factorDenominator, 20) ||
    !isNonEmptyString(row.status, 16) ||
    !isTimestamp(row.effectiveFrom) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidResponse();
  }
  return {
    id: row.id,
    itemCompanyProfileId: row.itemCompanyProfileId,
    fromUomId: row.fromUomId,
    toUomId: row.toUomId,
    revisionNumber: row.revisionNumber,
    factorNumerator: row.factorNumerator,
    factorDenominator: row.factorDenominator,
    status: row.status,
    effectiveFrom: row.effectiveFrom,
    version: row.version,
  };
}

export function parseInventorySerial(payload: unknown): InventorySerial {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.itemId) ||
    !isUuidV7(row.itemCompanyProfileId) ||
    !isNonEmptyString(row.serialKey, 120) ||
    !isNonEmptyString(row.state, 16) ||
    !isTimestamp(row.lastTransitionAt) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidResponse();
  }
  return {
    id: row.id,
    itemId: row.itemId,
    itemCompanyProfileId: row.itemCompanyProfileId,
    serialKey: row.serialKey,
    state: row.state,
    currentFulfillmentNodeId: isUuidV7(row.currentFulfillmentNodeId)
      ? row.currentFulfillmentNodeId
      : null,
    lastTransitionAt: row.lastTransitionAt,
    version: row.version,
  };
}

export function parseInventorySerialDetail(payload: unknown): InventorySerialDetail {
  const row = record(payload);
  if (!row || !Array.isArray(row.lifecycle)) invalidResponse();
  return {
    ...parseInventorySerial(payload),
    lifecycle: row.lifecycle.map((entry) => {
      const item = record(entry);
      if (!item || !isUuidV7(item.id) || !isTimestamp(item.occurredAt)) invalidResponse();
      return {
        id: item.id,
        eventType: typeof item.eventType === "string" ? item.eventType : "",
        occurredAt: item.occurredAt,
      };
    }),
  };
}

export function parseInventoryDecision(payload: unknown): InventoryDecision {
  const row = record(payload);
  const result = row ? record(row.result) : null;
  if (
    !row ||
    !result ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.decisionType, 40) ||
    !isNonEmptyString(row.aggregateType, 64) ||
    !isTimestamp(row.evaluatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: row.id,
    decisionType: row.decisionType,
    aggregateType: row.aggregateType,
    aggregateId: isUuidV7(row.aggregateId) ? row.aggregateId : "",
    outcome: typeof result.outcome === "string" ? result.outcome : null,
    explanationCode:
      typeof result.explanationCode === "string" ? result.explanationCode : null,
    explanation: typeof row.explanation === "string" ? row.explanation : null,
    evaluatedAt: row.evaluatedAt,
    correlationId: typeof row.correlationId === "string" ? row.correlationId : null,
  };
}

export function isPeriodStatus(value: unknown): value is PeriodStatus {
  return isMemberOf(value, PERIOD_STATUSES);
}

export function isUomConversionStatus(value: unknown): value is UomConversionStatus {
  return isMemberOf(value, UOM_CONVERSION_STATUSES);
}

export function isSerialState(value: unknown): value is SerialState {
  return isMemberOf(value, SERIAL_STATES);
}

export function isInventoryPolicyKind(value: unknown): value is InventoryPolicyKind {
  return isMemberOf(value, INVENTORY_POLICY_KINDS);
}
