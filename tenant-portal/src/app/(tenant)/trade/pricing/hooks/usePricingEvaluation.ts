"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../trade-advanced-scope";
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

export interface PinnedEvaluationItem {
  readonly id: string;
  readonly inputs: Readonly<EvaluateFormValues>;
  readonly scopeHeaders: Readonly<Record<string, string>>;
  readonly decision: PricingDecisionResult;
}

export type EvaluationTab = "waterfall" | "candidates" | "comparison" | "receipt";

const EMPTY_EVALUATE_FORM: EvaluateFormValues = {
  purpose: "SALES",
  itemId: "",
  uomId: "",
  quantity: "",
  currencyCode: "",
  priceBookId: "",
  partyId: "",
};

function readInitialEvaluateForm(): EvaluateFormValues {
  if (typeof window === "undefined") return EMPTY_EVALUATE_FORM;
  const params = new URLSearchParams(window.location.search);
  const purposeParam = params.get("purpose");
  const purpose: PriceBookPurpose = purposeParam === "PURCHASE" ? "PURCHASE" : "SALES";
  return {
    purpose,
    itemId: params.get("itemId") ?? "",
    uomId: params.get("uomId") ?? "",
    quantity: params.get("quantity") ?? "",
    currencyCode: params.get("currencyCode") ?? "",
    priceBookId: params.get("priceBookId") ?? "",
    partyId: params.get("partyId") ?? "",
  };
}

export function usePricingEvaluation() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [values, setValues] = useState<EvaluateFormValues>(readInitialEvaluateForm);
  const [evaluation, setEvaluation] = useState<PinnedEvaluationItem | null>(null);
  const [responseKey, setResponseKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EvaluationTab>("waterfall");
  const [pinnedEvaluations, setPinnedEvaluations] = useState<PinnedEvaluationItem[]>([]);
  const [noPrice, setNoPrice] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_READ_PERMISSION,
  );
  // Include scope so a decision cannot follow the form into another branch/company.
  const inputKey = JSON.stringify([values, scope.headers]);
  const matchesInputs = responseKey === inputKey && scope.isResolved && canRead;
  const currentEvaluation = matchesInputs ? evaluation : null;
  const result = currentEvaluation?.decision ?? null;
  const currentQueryError = matchesInputs ? queryError : null;

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
    const inputs = Object.freeze({
      ...values,
      ...request,
      priceBookId: request.priceBookId ?? "",
      partyId: request.partyId ?? "",
    });
    const scopeHeaders = Object.freeze({ ...scope.headers });
    setResponseKey(inputKey);
    setEvaluation(null);
    setIsEvaluating(true);
    setQueryError(null);
    setNoPrice(false);
    try {
      const response = await tradePost(PRICING_EVALUATE_PATH, request, {
        headers: scopeHeaders,
        maxResponseBytes: EVALUATE_RESPONSE_LIMIT_BYTES,
      });
      const parsed = parsePricingDecision(response.data);
      setEvaluation({ id: parsed.decisionId, inputs, scopeHeaders, decision: parsed });
    } catch (error) {
      const normalized = normalizeApiError(error);
      setEvaluation(null);
      if (normalized.code === "TRADE.PRICE.NO_ELIGIBLE_PRICE") {
        setNoPrice(true);
        return;
      }
      if (!toast.outcomeFromApi(normalized)) setQueryError(normalized);
    } finally {
      setIsEvaluating(false);
    }
  }, [isEvaluating, values, scope.headers, inputKey, toast, t]);

  const pinCurrentResult = useCallback(() => {
    if (!currentEvaluation) return;
    setPinnedEvaluations((current) => {
      if (current.some((item) => item.id === currentEvaluation.id)) return current;
      return [currentEvaluation, ...current].slice(0, 8);
    });
  }, [currentEvaluation]);

  const clearPinnedEvaluations = useCallback(() => {
    setPinnedEvaluations([]);
  }, []);

  const applyPreset = useCallback((preset: "retail" | "wholesale" | "vip") => {
    setValues((current) => ({
      ...current,
      purpose: "SALES",
      currencyCode: current.currencyCode.trim() || "SAR",
      quantity:
        preset === "retail"
          ? "10.00"
          : preset === "wholesale"
            ? "100.00"
            : "500.00",
    }));
  }, []);

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
    evaluatedInputs: currentEvaluation?.inputs ?? null,
    activeTab,
    setActiveTab,
    pinnedEvaluations,
    pinCurrentResult,
    clearPinnedEvaluations,
    applyPreset,
    noPrice: matchesInputs && noPrice,
    isEvaluating,
    queryError: currentQueryError,
    queryErrorMessage: currentQueryError ? pricingMessage(currentQueryError, t) : undefined,
    formError,
    setValue: (patch: Partial<EvaluateFormValues>) =>
      setValues((current) => ({ ...current, ...patch })),
    reset: () => {
      setValues(EMPTY_EVALUATE_FORM);
      setEvaluation(null);
      setResponseKey(null);
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
