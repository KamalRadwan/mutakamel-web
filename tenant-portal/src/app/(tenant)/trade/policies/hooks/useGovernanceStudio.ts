"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  GOVERNANCE_ACTION_PERMISSION,
  GOVERNANCE_PAGE_SIZE,
  POLICY_MANAGE_PERMISSION,
  POLICY_READ_PERMISSION,
  buildCreateDefinitionRequest,
  buildCreateVersionRequest,
  buildGovernanceActionRequest,
  governanceActionPath,
  governanceCreatePath,
  governanceListPath,
  governanceVersionsPath,
  parseGovernanceListResponse,
  type DefinitionFormValues,
  type DefinitionStatus,
  type GovernanceAction,
  type GovernanceFamily,
  type GovernedDefinition,
  type GovernedVersion,
  type VersionFormValues,
} from "../governance-contract";
import { governanceFormMessage, governanceMessage } from "../governance-messages";

const LIST_RESPONSE_LIMIT_BYTES = 1_000_000;
const ROW_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * One hook for both governed families.
 *
 * `/trade/workflows` imports this rather than restating it because the backend
 * does the same: `PolicyStudioController` serves policies and workflows from a
 * single service through one `GovernanceAdapter`, with identical DTOs,
 * identical `trade.policy.*` permissions and an identical nine-verb ladder.
 * The `family` argument is the adapter switch, and it is the only difference.
 */
export function useGovernanceStudio(family: GovernanceFamily) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  // OPERATING_CONTEXT: a branch header resolves BRANCH, a company header
  // COMPANY, and neither resolves TENANT — all three are legal here.
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<GovernedDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<DefinitionStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<GovernedDefinition | null>(null);
  const [ladderFor, setLadderFor] = useState<GovernedDefinition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<GovernanceAction | null>(null);

  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, POLICY_READ_PERMISSION);
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    POLICY_MANAGE_PERMISSION,
  );
  const canRun = useCallback(
    (action: GovernanceAction) =>
      hasTradePermission(
        scope.permissions,
        scope.isTenantOwner,
        GOVERNANCE_ACTION_PERMISSION[action],
      ),
    [scope.permissions, scope.isTenantOwner],
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(governanceListPath(family, page, kind, status), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseGovernanceListResponse(response.data, family);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [family, page, kind, status, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const createDefinition = useCallback(
    async (values: DefinitionFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          governanceCreatePath(family),
          buildCreateDefinitionRequest(family, values),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeGovernance.definitionCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(governanceMessage(normalized, t) ?? governanceFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, family, scope.headers, toast, t, load],
  );

  const createVersion = useCallback(
    async (values: VersionFormValues): Promise<boolean> => {
      if (!canManage || !versionFor || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          governanceVersionsPath(family, versionFor.id),
          buildCreateVersionRequest(values),
          {
            headers: {
              ...scope.headers,
              "If-Match": tradeIfMatch(versionFor.version),
            },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        );
        setVersionFor(null);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeGovernance.versionCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(governanceMessage(normalized, t) ?? governanceFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, versionFor, isSubmitting, family, scope.headers, toast, t, load],
  );

  const runAction = useCallback(
    async (version: GovernedVersion, action: GovernanceAction, reason: string): Promise<void> => {
      if (!canRun(action) || pendingAction) return;
      setPendingAction(action);
      try {
        await tradePost(
          governanceActionPath(family, version.id, action),
          buildGovernanceActionRequest(reason),
          {
            headers: { ...scope.headers, "If-Match": tradeIfMatch(version.version) },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        );
        toast.success(t.tradeCommon.savedTitle, t.tradeGovernance.actionApplied);
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(
            t.tradeGovernance.actionFailedTitle,
            governanceMessage(normalized, t) ?? governanceFormMessage(error, t),
          );
        }
      } finally {
        setPendingAction(null);
        await load();
      }
    },
    [canRun, pendingAction, family, scope.headers, toast, t, load],
  );

  return {
    t,
    lang,
    family,
    canRead,
    canManage,
    canRun,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo: { page, limit: GOVERNANCE_PAGE_SIZE, total },
    kind,
    status,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    versionFor,
    ladderFor: ladderFor
      ? (items.find((entry) => entry.id === ladderFor.id) ?? ladderFor)
      : null,
    isSubmitting,
    formError,
    pendingAction,
    setPage,
    setKind: (next: string | undefined) => {
      setPage(1);
      setKind(next);
    },
    setStatus: (next: DefinitionStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openVersion: (definition: GovernedDefinition) => {
      setFormError(null);
      setVersionFor(definition);
    },
    closeVersion: () => {
      if (isSubmitting) return;
      setVersionFor(null);
    },
    openLadder: (definition: GovernedDefinition) => setLadderFor(definition),
    closeLadder: () => {
      if (pendingAction) return;
      setLadderFor(null);
    },
    createDefinition,
    createVersion,
    runAction,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
