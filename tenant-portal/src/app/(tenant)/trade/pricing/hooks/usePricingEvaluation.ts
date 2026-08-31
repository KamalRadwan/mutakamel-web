"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import { isDecimalString } from "../../trade-advanced-validation";
import {
  CURRENCY_CODE_PATTERN,
  PRICING_EVALUATE_PATH,
  PRICING_READ_PERMISSION,
  parsePricingDecision,
  type PriceBookPurpose,
  type PricingDecisionResult,
} from "../../price-books/pricing-contract";
import { pricingFormMessage, pricingMessage } from "../../price-books/pricing-messages";

const EVALUATE_RESPONSE_LIMIT_BYTES = 120_000;

export interface EvaluateFormValues {
  purpose: PriceBookPurpose;
  itemId: string;
  uomId: string;
  quantity: string;
  currencyCode: string;
  priceBookId: string;
  partyId: string;
}

const EMPTY_EVALUATE_FORM: EvaluateFormValues = {
  purpose: "SALES",
  itemId: "",
  uomId: "",
  quantity: "",
  currencyCode: "",
  priceBookId: "",
  partyId: "",
};

/**
 * `POST /pricing/evaluate` is a **read**, not a write.
 *
 * The Gateway classes it `READ_HEAVY`, the handler takes no
 * `x-idempotency-key`, and it answers 200. The transport still attaches a key
 * to every POST, which the server simply ignores here.
 *
 * The failure that matters most: `TRADE.PRICE.NO_ELIGIBLE_PRICE` is a **404**
 * meaning "no price applies", not "this route is missing", so it renders as an
 * answer rather than as a not-found page.
 */
export function usePricingEvaluation() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  // COMPANY_OR_BRANCH: a branch header narrows it, and both are legal.
  const scope = useTradeScope("BRANCH", branchId);

  const [values, setValues] = useState<EvaluateFormValues>(EMPTY_EVALUATE_FORM);
  const [result, setResult] = useState<PricingDecisionResult | null>(null);
  const [noPrice, setNoPrice] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_READ_PERMISSION,
  );

  const evaluate = useCallback(async (): Promise<void> => {
    if (isEvaluating) return;
    setFormError(null);
    let request: Record<string, string>;
    try {
      request = buildEvaluateRequest(values);
    } catch (error) {
      setFormError(pricingFormMessage(error, t));
      return;
    }
    setIsEvaluating(true);
    setQueryError(null);
    setNoPrice(false);
    try {
      const response = await tradePost(PRICING_EVALUATE_PATH, request, {
        headers: scope.headers,
        maxResponseBytes: EVALUATE_RESPONSE_LIMIT_BYTES,
      });
      setResult(parsePricingDecision(response.data));
    } catch (error) {
      const normalized = normalizeApiError(error);
      setResult(null);
      if (normalized.code === "TRADE.PRICE.NO_ELIGIBLE_PRICE") {
        setNoPrice(true);
        return;
      }
      if (!toast.outcomeFromApi(normalized)) setQueryError(normalized);
    } finally {
      setIsEvaluating(false);
    }
  }, [isEvaluating, values, scope.headers, toast, t]);

  return {
    t,
    lang,
    canRead,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    values,
    result,
    noPrice,
    isEvaluating,
    queryError,
    queryErrorMessage: queryError ? pricingMessage(queryError, t) : undefined,
    formError,
    setValue: (patch: Partial<EvaluateFormValues>) =>
      setValues((current) => ({ ...current, ...patch })),
    reset: () => {
      setValues(EMPTY_EVALUATE_FORM);
      setResult(null);
      setNoPrice(false);
      setQueryError(null);
      setFormError(null);
    },
    evaluate,
  };
}

function buildEvaluateRequest(values: EvaluateFormValues): Record<string, string> {
  const itemId = values.itemId.trim();
  const uomId = values.uomId.trim();
  const quantity = values.quantity.trim();
  const currencyCode = values.currencyCode.trim().toUpperCase();
  if (!isUUIDv7(itemId) || !isUUIDv7(uomId)) throw new Error("PRICING_FORM_ENTRY_ID");
  if (!isDecimalString(quantity) || Number(quantity) <= 0) {
    throw new Error("PRICING_FORM_QUANTITY");
  }
  if (!CURRENCY_CODE_PATTERN.test(currencyCode)) throw new Error("PRICING_FORM_CURRENCY");

  const request: Record<string, string> = {
    purpose: values.purpose,
    itemId,
    uomId,
    quantity,
    currencyCode,
  };
  // `forbidNonWhitelisted` is on, so an empty optional is omitted rather than
  // sent as "".
  const priceBookId = values.priceBookId.trim();
  if (priceBookId.length > 0) {
    if (!isUUIDv7(priceBookId)) throw new Error("PRICING_FORM_ENTRY_ID");
    request.priceBookId = priceBookId;
  }
  const partyId = values.partyId.trim();
  if (partyId.length > 0) {
    if (!isUUIDv7(partyId)) throw new Error("PRICING_FORM_ENTRY_ID");
    request.partyId = partyId;
  }
  return request;
}
