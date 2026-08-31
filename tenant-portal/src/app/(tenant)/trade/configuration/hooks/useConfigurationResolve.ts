"use client";

import { useCallback, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { tradePost } from "../../trade-api";
import { canPerformTradeAction, TRADE_PERMISSIONS } from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  DEFINITION_NOT_FOUND_CODE,
  RESOLVE_PATH,
  VALUE_INVALID_CODE,
  buildResolveRequest,
  parseResolveResponse,
  type ResolvedConfiguration,
} from "../configuration-contract";
import { configurationFormMessage } from "./useConfigurationDefinitions";

const RESOLVE_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * `POST /configuration/resolve` — a 200, and the one route on this page gated
 * on **any** MVP feature rather than `trade.policy_studio`, so a tenant without
 * the policy studio can still read effective values.
 */
export function useConfigurationResolve() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canRead = canPerformTradeAction(user, TRADE_PERMISSIONS.configurationRead);
  const { headers } = useTradeScopeRequest("OPERATING_CONTEXT");

  const [keys, setKeys] = useState("");
  const [facts, setFacts] = useState("");
  const [resolved, setResolved] = useState<ResolvedConfiguration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === DEFINITION_NOT_FOUND_CODE) return t.trade.definitionNotFoundDescription;
      if (error.code === VALUE_INVALID_CODE) return t.trade.valueInvalid;
      return undefined;
    },
    [t],
  );

  const resolve = useCallback(async (): Promise<void> => {
    if (!canRead || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const request = buildResolveRequest(keys, facts);
      const outcome = await runWrite(
        async () => {
          const result = await tradePost(RESOLVE_PATH, request, {
            headers,
            maxResponseBytes: RESOLVE_RESPONSE_LIMIT_BYTES,
          });
          setResolved(parseResolveResponse(result.data));
          return result;
        },
        { failureTitle: t.trade.resolveFailed, describe },
      );
      if (!outcome.ok) setResolved(null);
    } catch (error) {
      setFormError(configurationFormMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }, [canRead, isSubmitting, keys, facts, runWrite, headers, describe, t]);

  return {
    lang,
    canRead,
    keys,
    facts,
    resolved,
    isSubmitting,
    formError,
    setKeys,
    setFacts,
    resolve,
  };
}
