"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { useI18n } from "@/i18n/I18nContext";
import type { TenantUser } from "../../../core/contracts/user-contract";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { isVersion, parseTradeListPage, record, tradeDocumentPath, tradeInvalidResponse } from "../../documents/trade-document-contract";
import { discountValue } from "../quotation-discount-draft";
import { parseQuotationDiscountLimits, type QuotationDiscountLimits } from "../quotation-discount-contract";
import { QUOTATION_DISCOUNT_LIMITS_PATH } from "./useQuotationDiscountPolicy";
import { useQuotationDiscountUsers } from "./useQuotationDiscountUsers";

export interface QuotationDiscountLimit extends QuotationDiscountLimits {
  id: string; version: number; companyId: string; branchId: string; actorUserId: string; active: boolean;
}
interface LimitDraft extends QuotationDiscountLimits { active: boolean }
const empty = (): LimitDraft => ({ maxPercent: "0", allowFreeItems: false, reasonRequired: false, active: true });
function parseQuotationDiscountLimit(payload: unknown): QuotationDiscountLimit {
  const row = record(payload);
  if (!row || !isUUIDv7(row.id) || !isVersion(row.version) || !isUUIDv7(row.companyId)
    || !isUUIDv7(row.branchId) || !isUUIDv7(row.actorUserId) || typeof row.active !== "boolean") tradeInvalidResponse();
  return { ...parseQuotationDiscountLimits(row), id: row.id, version: row.version,
    companyId: row.companyId, branchId: row.branchId, actorUserId: row.actorUserId, active: row.active };
}

export function useQuotationDiscountLimits(headers: Record<string, string>, allowed: boolean, onChanged: () => void) {
  const { t } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const write = useTradeWrite();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<{ scope: string; user: TenantUser | null }>({ scope: "", user: null });
  const [attempt, setAttempt] = useState(0);
  const scope = JSON.stringify([user?.id, realtimeAuthGeneration, Object.entries(headers).sort()]);
  const selected = selection.scope === scope ? selection.user : null;
  const editIdentity = JSON.stringify([scope, selected?.id ?? null]);
  const identity = JSON.stringify([editIdentity, attempt]);
  const [loaded, setLoaded] = useState<{ identity: string; limit: QuotationDiscountLimit | null; error: NormalizedApiError | null } | null>(null);
  const [edited, setEdited] = useState<{ identity: string; draft: LimitDraft } | null>(null);
  const users = useQuotationDiscountUsers(open && allowed);
  const current = loaded?.identity === identity ? loaded : null;
  const draft = edited?.identity === editIdentity ? edited.draft : current?.limit ?? empty();
  const enabled = open && allowed && Boolean(selected);
  const headersKey = JSON.stringify(Object.entries(headers).sort());
  useEffect(() => {
    if (!enabled || !selected) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: "1", limit: "25", actorUserId: selected.id });
    const expectedScope: Record<string, string> = Object.fromEntries(JSON.parse(headersKey) as [string, string][]);
    void tradeGet(`${QUOTATION_DISCOUNT_LIMITS_PATH}?${query}`, { headers: expectedScope, signal: controller.signal,
      maxResponseBytes: 100_000, suppressForbiddenToast: true,
    }).then((response) => {
      const result = parseTradeListPage(response.data, parseQuotationDiscountLimit);
      if (result.items.length > 1 || result.items.some((item) => item.actorUserId !== selected.id
        || item.companyId !== expectedScope[COMPANY_SCOPE_HEADER] || item.branchId !== expectedScope[BRANCH_SCOPE_HEADER])) tradeInvalidResponse();
      if (!controller.signal.aborted) setLoaded({ identity, limit: result.items[0] ?? null, error: null });
    }).catch((error: unknown) => { if (!controller.signal.aborted) setLoaded({ identity, limit: null, error: normalizeApiError(error) }); });
    return () => controller.abort();
  }, [enabled, headersKey, identity, selected]);
  const loading = enabled && !current;
  const value = discountValue(draft.maxPercent, "PERCENT");
  const dirty = Boolean(selected && edited?.identity === editIdentity);
  const conflicted = write.writeError?.code === "TRADE.CONCURRENCY.STALE_VERSION"
    || write.writeError?.code === "TRADE.QUOTE.DISCOUNT_LIMIT_CONFLICT";
  const update = useCallback((patch: Partial<LimitDraft>) => {
    if (allowed && !write.isBlocked) setEdited({ identity: editIdentity, draft: { ...draft, ...patch } });
  }, [allowed, draft, editIdentity, write.isBlocked]);
  const submit = async () => {
    if (!allowed || !selected || value === null || loading || current?.error || write.isBlocked || conflicted) return;
    const body = { maxPercent: value, allowFreeItems: draft.allowFreeItems,
      reasonRequired: draft.reasonRequired, active: draft.active };
    const scopeHeaders: Record<string, string> = Object.fromEntries(JSON.parse(headersKey) as [string, string][]);
    const known = current?.limit;
    let confirmed: QuotationDiscountLimit | null = null;
    await write.runWrite({ operation: t.quotationDiscount.saveLimit,
      send: async (idempotency) => {
        const response = known
        ? await tradePatch(tradeDocumentPath(QUOTATION_DISCOUNT_LIMITS_PATH, known.id), body,
          { headers: { ...scopeHeaders, ...idempotency, "if-match": tradeIfMatch(known.version) }, maxResponseBytes: 100_000 })
        : await tradePost(QUOTATION_DISCOUNT_LIMITS_PATH, { actorUserId: selected.id, ...body },
          { headers: { ...scopeHeaders, ...idempotency }, maxResponseBytes: 100_000 });
        confirmed = parseQuotationDiscountLimit(response.data);
        if (confirmed.actorUserId !== selected.id || confirmed.companyId !== scopeHeaders[COMPANY_SCOPE_HEADER]
          || confirmed.branchId !== scopeHeaders[BRANCH_SCOPE_HEADER]) tradeInvalidResponse();
        return response;
      },
      onSuccess: () => {
        if (confirmed) { setLoaded({ identity, limit: confirmed, error: null }); setEdited(null); onChanged(); }
      },
    });
  };
  return { open, selected, users, draft, limit: current?.limit ?? null, loading, error: current?.error ?? null,
    write, dirty, conflicted, canSubmit: Boolean(allowed && selected && value !== null && !loading && !current?.error && !write.isBlocked && !conflicted),
    valueError: value === null ? t.quotationDiscount.invalidPercent : undefined,
    setOpen: (next: boolean) => { if (!write.isBlocked) setOpen(next && allowed); },
    selectUser: (id: string | undefined) => {
      if (!allowed || write.isBlocked) return;
      const selectedUser = users.items.find((item) => item.id === id) ?? null;
      if (!id || selectedUser) { setSelection({ scope, user: selectedUser }); setEdited(null); write.clearWriteError(); }
    },
    update, submit,
    retry: () => { if (!write.isBlocked) { write.clearWriteError(); setAttempt((value) => value + 1); } },
  };
}
export type QuotationDiscountLimitsState = ReturnType<typeof useQuotationDiscountLimits>;
