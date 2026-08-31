"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  DEFINITIONS_PATH,
  DEFINITION_INVALID_CODE,
  DEFINITION_KEY_TAKEN_CODE,
  DEFINITION_PAGE_SIZE,
  EFFECTIVE_OVERLAP_CODE,
  MAKER_CHECKER_CODE,
  PUBLISH_NOT_ALLOWED_CODE,
  SCOPE_FORBIDDEN_CODE,
  TEST_FAILED_CODE,
  VALUE_INVALID_CODE,
  buildCreateDefinitionRequest,
  buildCreateVersionRequest,
  definitionVersionsPath,
  definitionsListPath,
  parseDefinitionsResponse,
  parseTestReport,
  versionActionPath,
  type ConfigurationDefinition,
  type ConfigurationVersion,
  type DefinitionFormValues,
  type VersionFormValues,
  type VersionTestReport,
} from "../configuration-contract";

const LIST_RESPONSE_LIMIT_BYTES = 800_000;

export function useConfigurationDefinitions() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.configurationManage);
  /** Publishing needs `trade.policy.publish` — configuration-manage is not enough. */
  const canPublish = canPerformTradeAction(user, TRADE_PERMISSIONS.policyPublish);
  const { headers } = useTradeScopeRequest("OPERATING_CONTEXT");

  const [items, setItems] = useState<ConfigurationDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<ConfigurationDefinition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<VersionTestReport | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await tradeGet(definitionsListPath(page), {
          signal,
          headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseDefinitionsResponse(result.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === DEFINITION_KEY_TAKEN_CODE) return t.trade.definitionKeyTaken;
      if (error.code === DEFINITION_INVALID_CODE) return t.trade.definitionInvalid;
      if (error.code === SCOPE_FORBIDDEN_CODE) return t.trade.scopeForbidden;
      if (error.code === VALUE_INVALID_CODE) return t.trade.valueInvalid;
      if (error.code === EFFECTIVE_OVERLAP_CODE) return t.trade.effectiveOverlap;
      if (error.code === TEST_FAILED_CODE) return t.trade.testFailed;
      if (error.code === PUBLISH_NOT_ALLOWED_CODE) return t.trade.publishNotAllowed;
      if (error.code === MAKER_CHECKER_CODE) return t.trade.makerCheckerRequired;
      return undefined;
    },
    [t],
  );

  const createDefinition = useCallback(
    async (values: DefinitionFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateDefinitionRequest(values);
        // TENANT target: no scope headers.
        const outcome = await runWrite(() => tradePost(DEFINITIONS_PATH, request, {}), {
          failureTitle: t.trade.definitionCreateFailed,
          describe,
        });
        if (!outcome.ok) return false;
        setCreateOpen(false);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        await load();
        return true;
      } catch (error) {
        setFormError(configurationFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, runWrite, describe, toast, t, load],
  );

  /** `If-Match` here carries the **definition's** version, not a version's own. */
  const createVersion = useCallback(
    async (values: VersionFormValues): Promise<boolean> => {
      if (!canManage || !versionFor || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateVersionRequest(values);
        const outcome = await runWrite(
          () =>
            tradePost(definitionVersionsPath(versionFor.id), request, {
              headers: { ...headers, "if-match": tradeIfMatch(versionFor.version) },
            }),
          { failureTitle: t.trade.versionCreateFailed, describe },
        );
        // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved
        // the row. Trade has no force-write path, so the only honest
        // response is to refetch and let the user see the server's value.
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) await load();
          return false;
        }
        setVersionFor(null);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        await load();
        return true;
      } catch (error) {
        setFormError(configurationFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, versionFor, isSubmitting, runWrite, headers, describe, toast, t, load],
  );

  const runVersionAction = useCallback(
    async (version: ConfigurationVersion, action: "test" | "publish"): Promise<void> => {
      const allowed = action === "publish" ? canPublish : canManage;
      if (!allowed || isSubmitting) return;
      setIsSubmitting(true);
      setReport(null);
      const outcome = await runWrite(
        async () => {
          const result = await tradePost(versionActionPath(version.id, action), undefined, {
            headers: { ...headers, "if-match": tradeIfMatch(version.version) },
          });
          if (action === "test") setReport(parseTestReport(result.data));
          return result;
        },
        {
          failureTitle:
            action === "publish" ? t.trade.versionPublishFailed : t.trade.versionTestFailed,
          describe,
        },
      );
      setIsSubmitting(false);
      if (!outcome.ok) {
        if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) await load();
        return;
      }
      toast.success(t.trade.savedTitle, replayOrDone(outcome.replayed, action, t));
      await load();
    },
    [canPublish, canManage, isSubmitting, runWrite, headers, describe, toast, t, load],
  );

  return {
    t,
    lang,
    canManage,
    canPublish,
    items,
    pageInfo: { page, limit: DEFINITION_PAGE_SIZE, total },
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    versionFor,
    selectedId,
    report,
    setPage,
    setSelectedId,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openVersion: (definition: ConfigurationDefinition) => {
      setFormError(null);
      setVersionFor(definition);
    },
    closeVersion: () => {
      if (isSubmitting) return;
      setVersionFor(null);
    },
    createDefinition,
    createVersion,
    runVersionAction,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function replayOrDone(replayed: boolean, action: "test" | "publish", t: Dictionary): string {
  if (replayed) return t.trade.replayedDescription;
  return action === "test" ? t.trade.versionTestPassed : t.trade.savedDescription;
}

export function configurationFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "DEFINITION_FORM_KEY") return t.trade.definitionFormKey;
  if (reason === "DEFINITION_FORM_SCHEMA") return t.trade.definitionFormSchema;
  if (reason === "DEFINITION_FORM_SCOPES") return t.trade.definitionFormScopes;
  if (reason === "VERSION_FORM_VALUE") return t.trade.versionFormValue;
  if (reason === "VERSION_FORM_DATE") return t.trade.versionFormDate;
  if (reason === "RESOLVE_FORM_KEYS") return t.trade.resolveFormKeys;
  return t.trade.jsonInvalid;
}
