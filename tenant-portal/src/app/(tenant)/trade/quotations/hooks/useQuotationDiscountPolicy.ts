"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { TradePath } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import { isVersion, record, tradeInvalidResponse } from "../../documents/trade-document-contract";
import { parseQuotationDiscountLimits, type QuotationDiscountLimits } from "../quotation-discount-contract";
import { QUOTATIONS_PATH } from "../quotation-contract";
import { hasQuotationScope } from "../quotation-composer-draft";

// documents/quotation-discounts/quotation-discount-limits.controller.ts.
const QUOTATION_DISCOUNT_POLICY_PATH = `${QUOTATIONS_PATH}/discount-policy` as TradePath;
export const QUOTATION_DISCOUNT_LIMITS_PATH = `${QUOTATIONS_PATH}/discount-limits` as TradePath;
export interface QuotationDiscountPolicy {
  canApply: boolean; hasApplyPermission: boolean; canManage: boolean; configured: boolean;
  limit: (QuotationDiscountLimits & { id: string; version: number }) | null;
}
export function parseQuotationDiscountPolicy(payload: unknown): QuotationDiscountPolicy {
  const row = record(payload);
  if (!row || typeof row.canApply !== "boolean" || typeof row.hasApplyPermission !== "boolean" || typeof row.canManage !== "boolean" || typeof row.configured !== "boolean") tradeInvalidResponse();
  const limit = row.limit === null ? null : parseLimitSnapshot(row.limit);
  if (row.configured !== Boolean(limit) || row.canApply !== (row.hasApplyPermission && row.configured)) tradeInvalidResponse();
  return { canApply: row.canApply, hasApplyPermission: row.hasApplyPermission, canManage: row.canManage, configured: row.configured, limit };
}
function parseLimitSnapshot(payload: unknown) {
  const row = record(payload);
  if (!row || !isUUIDv7(row.id) || !isVersion(row.version)) tradeInvalidResponse();
  return { ...parseQuotationDiscountLimits(row), id: row.id, version: row.version };
}

export function useQuotationDiscountPolicy(headers: Record<string, string>, enabled: boolean) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, Object.entries(headers).sort(), attempt]);
  const identity = useMemo(() => ({ key }), [key]);
  const [settled, setSettled] = useState<{ identity: object; policy: QuotationDiscountPolicy | null; error: NormalizedApiError | null } | null>(null);
  const valid = enabled && Boolean(user?.id) && hasQuotationScope(headers);
  useEffect(() => {
    if (!valid) return;
    const [, , headerEntries] = JSON.parse(identity.key) as [string, number, [string, string][]];
    const controller = new AbortController();
    void tradeGet(QUOTATION_DISCOUNT_POLICY_PATH, { headers: Object.fromEntries(headerEntries), signal: controller.signal,
      maxResponseBytes: 50_000, suppressForbiddenToast: true,
    }).then((response) => {
      const policy = parseQuotationDiscountPolicy(response.data);
      if (!controller.signal.aborted) setSettled({ identity, policy, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setSettled({ identity, policy: null, error: normalizeApiError(error) });
    });
    return () => controller.abort();
  }, [identity, valid]);
  const current = valid && settled?.identity === identity ? settled : null;
  return { policy: current?.policy ?? null, loading: valid && !current, error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1) };
}
