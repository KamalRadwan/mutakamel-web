import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useActionMutation } from "@/shared/hooks/useActionMutation";
import { useToast } from "@/components/ui/ToastContext";
import { shouldResetDatabaseServerWriteKey } from "../lib/database-server-idempotency";
import {
  DatabaseServerView,
  UpdateDatabaseServerDto,
  DatabaseServerApplicationBindingView,
  DatabaseServerHistoryView,
  ApplicationCredentialBootstrapReceipt,
  ApplicationCredentialMutationReceipt,
  DatabaseCredentialAction,
  ApplicationDatabaseCredentialCommandDto,
  BootstrapDatabaseServerApplicationDto,
  BootstrapDatabaseServerApplicationsDto,
  DatabaseServerProvisioningPrincipalBindingView,
  DatabaseServerSystemCredentialMutationReceipt,
  UpdateDatabaseServerSystemPrincipalRotationDto,
} from "../types";

export function useDatabaseServerDetail(id: string) {
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const { mutate } = useActionMutation();
  const idRef = useRef(id);
  const serverGeneration = useRef(0);
  const bindingsGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const serverAbort = useRef<AbortController | null>(null);
  const bindingsAbort = useRef<AbortController | null>(null);
  const historyAbort = useRef<AbortController | null>(null);

  const [server, setServer] = useState<DatabaseServerView | null>(null);
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);
  const [bindings, setBindings] = useState<DatabaseServerApplicationBindingView[]>([]);
  const [history, setHistory] = useState<DatabaseServerHistoryView[]>([]);
  const [lastCredentialReceipt, setLastCredentialReceipt] = useState<
    ApplicationCredentialBootstrapReceipt | ApplicationCredentialMutationReceipt | DatabaseServerSystemCredentialMutationReceipt | null
  >(null);
  const [credentialActionPending, setCredentialActionPending] = useState<string | null>(null);
  const [credentialAction, setCredentialAction] = useState<DatabaseCredentialAction | null>(null);
  const [credentialActionServerId, setCredentialActionServerId] = useState<string | null>(null);
  const [credentialReason, setCredentialReason] = useState("");
  const [credentialActionError, setCredentialActionError] = useState<string | NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isBindingsLoading, setIsBindingsLoading] = useState(false);
  const [bindingsError, setBindingsError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useLayoutEffect(() => {
    idRef.current = id;
  }, [id]);

  const fetchBindings = useCallback(async () => {
    const requestedId = id;
    const generation = ++bindingsGeneration.current;
    bindingsAbort.current?.abort();
    const controller = new AbortController();
    bindingsAbort.current = controller;
    setIsBindingsLoading(true);
    setBindingsError(null);
    try {
      const next = await databaseServersApi.listApplications(id, controller.signal);
      if (
        generation === bindingsGeneration.current &&
        !controller.signal.aborted &&
        idRef.current === requestedId
      ) setBindings(next);
    } catch (requestError) {
      if (
        generation === bindingsGeneration.current &&
        !controller.signal.aborted &&
        idRef.current === requestedId
      ) setBindingsError(normalizeApiError(requestError).message);
    } finally {
      if (generation === bindingsGeneration.current) setIsBindingsLoading(false);
    }
  }, [id]);

  const fetchHistory = useCallback(async () => {
    const requestedId = id;
    const generation = ++historyGeneration.current;
    historyAbort.current?.abort();
    const controller = new AbortController();
    historyAbort.current = controller;
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const next = await databaseServersApi.getHistory(id, undefined, controller.signal);
      if (
        generation === historyGeneration.current &&
        !controller.signal.aborted &&
        idRef.current === requestedId
      ) setHistory(next);
    } catch (requestError) {
      if (
        generation === historyGeneration.current &&
        !controller.signal.aborted &&
        idRef.current === requestedId
      ) setHistoryError(normalizeApiError(requestError).message);
    } finally {
      if (generation === historyGeneration.current) setIsHistoryLoading(false);
    }
  }, [id]);

  // Failure reconciliation must keep the original command dialog mounted.
  const readServer = useCallback(async (background: boolean) => {
    const requestedId = id;
    const generation = ++serverGeneration.current;
    serverAbort.current?.abort();
    const controller = new AbortController();
    serverAbort.current = controller;
    setRefreshError(null);
    if (!background) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await databaseServersApi.get(id, controller.signal);
      if (
        generation !== serverGeneration.current ||
        controller.signal.aborted ||
        idRef.current !== requestedId
      ) return;
      setServer(data);
      setLoadedServerId(requestedId);
      await Promise.all([fetchBindings(), fetchHistory()]);
    } catch (err) {
      if (
        generation !== serverGeneration.current ||
        controller.signal.aborted ||
        idRef.current !== requestedId
      ) return;
      const normalized = normalizeApiError(err);
      setLoadedServerId(null);
      if (!background) {
        setError(normalized.message);
        toast.error("Error", normalized.message);
      } else {
        setRefreshError(normalized.message);
      }
    } finally {
      if (generation === serverGeneration.current) setIsLoading(false);
    }
  }, [fetchBindings, fetchHistory, id, toast]);

  const fetchServer = useCallback(() => readServer(false), [readServer]);
  const refreshServer = useCallback(() => readServer(true), [readServer]);

  useEffect(() => {
    queueMicrotask(() => {
      setServer(null);
      setLoadedServerId(null);
      setBindings([]);
      setHistory([]);
      setLastCredentialReceipt(null);
      setCredentialActionPending(null);
      setCredentialAction(null);
      setCredentialActionServerId(null);
      setCredentialReason("");
      setCredentialActionError(null);
      void fetchServer();
    });
    return () => {
      serverAbort.current?.abort();
      bindingsAbort.current?.abort();
      historyAbort.current?.abort();
    };
  }, [fetchServer, id]);

  const assertCurrentServer = () => {
    if (idRef.current !== id || loadedServerId !== id) {
      throw new Error("DATABASE_SERVER_CONTEXT_CHANGED");
    }
  };

  const mutationOptions = (message: string) => {
    const ownerServerId = id;
    const reconcileOwner = () => {
      if (idRef.current !== ownerServerId) return;
      return fetchServer();
    };
    return {
      onSuccessMessage: message,
      onSuccess: reconcileOwner,
      onErrorReconcile: reconcileOwner,
    };
  };

  const updateServer = (dto: UpdateDatabaseServerDto) => {
    assertCurrentServer();
    return mutate(
      { action: "update", id, dto },
      (key) => databaseServersApi.update(id, dto, key),
      mutationOptions("Database Server updated successfully.")
    );
  };

  const drainServer = () => {
    assertCurrentServer();
    return mutate(
      { action: "drain", id },
      (key) => databaseServersApi.drain(id, key),
      mutationOptions("Server drained.")
    );
  };

  const activateServer = () => {
    assertCurrentServer();
    return mutate(
      { action: "activate", id },
      (key) => databaseServersApi.activate(id, key),
      mutationOptions("Server activated.")
    );
  };

  const offlineServer = () => {
    assertCurrentServer();
    return mutate(
      { action: "offline", id },
      (key) => databaseServersApi.offline(id, key),
      mutationOptions("Server offline.")
    );
  };

  const deleteServer = () => {
    assertCurrentServer();
    return mutate(
      { action: "delete", id },
      (key) => databaseServersApi.delete(id, key),
      {
        onSuccessMessage: "Server deleted.",
        onErrorReconcile: () => {
          if (idRef.current !== id) return;
          return fetchServer();
        },
      }
    );
  };

  // Credential Commands

  const retryBootstrap = async (reason: string) => {
    assertCurrentServer();
    setCredentialActionPending("retry-bootstrap");
    try {
      const dto: BootstrapDatabaseServerApplicationsDto = { reason };
      const key = getIdempotencyKey({ action: "retry-bootstrap", id, ...dto });
      const updated = await databaseServersApi.retryBootstrap(id, dto, key);
      if (idRef.current !== id) return updated;
      setServer(updated);
      toast.success("Registration setup retried", `${updated.credentialBootstrap.readyPrincipals}/${updated.credentialBootstrap.totalPrincipals} required access bindings are ready.`);
      resetKey();
      await fetchServer();
      return updated;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      await readServer(true);
      if (idRef.current !== id) throw normalized;
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      if (idRef.current === id) setCredentialActionPending(null);
    }
  };

  const mutateProvisioningCredential = async (
    kind: "regenerate-system" | "reconcile-system",
    expectedCredentialRevision: string,
    reason: string,
  ) => {
    assertCurrentServer();
    setCredentialActionPending(`${kind}:PROVISIONING`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: kind, id, purpose: "PROVISIONING", ...dto });
      const receipt = kind === "regenerate-system"
        ? await databaseServersApi.regenerateProvisioningPrincipal(id, dto, key)
        : await databaseServersApi.reconcileProvisioningPrincipal(id, dto, key);
      if (idRef.current !== id) return receipt;
      setLastCredentialReceipt(receipt);
      toast.success("Provisioning credential ready", `${receipt.databasePrincipal} advanced to revision ${receipt.credentialRevision}.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      await readServer(true);
      if (idRef.current !== id) throw normalized;
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      if (idRef.current === id) setCredentialActionPending(null);
    }
  };

  const updateProvisioningRotationPolicy = async (
    dto: UpdateDatabaseServerSystemPrincipalRotationDto,
  ) => {
    assertCurrentServer();
    const key = getIdempotencyKey({ action: "provisioning-rotation-policy", id, ...dto });
    try {
      const updated = await databaseServersApi.updateProvisioningRotationPolicy(id, dto, key);
      if (idRef.current !== id) return updated;
      toast.success("Rotation policy updated", `${updated.databasePrincipal} now uses the saved maintenance-aware schedule.`);
      resetKey();
      await fetchServer();
      return updated;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    }
  };

  const bootstrapApplication = async (applicationKey: string, expectedCatalogueRevision: string, expectedPolicyRevision: string, reason: string) => {
    assertCurrentServer();
    if (isBindingsLoading || bindingsError) {
      throw new Error("DATABASE_SERVER_BINDINGS_REFRESH_REQUIRED");
    }
    setCredentialActionPending(`bootstrap:${applicationKey}`);
    try {
      const dto: BootstrapDatabaseServerApplicationDto = { expectedCatalogueRevision, expectedPolicyRevision, reason };
      const key = getIdempotencyKey({ action: "bootstrap-application", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.bootstrapApplication(id, applicationKey, dto, key);
      if (idRef.current !== id) return receipt;
      setLastCredentialReceipt(receipt);
      toast.success("Application access ready", `${applicationKey} was verified. Its password was not disclosed to the browser.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      await readServer(true);
      if (idRef.current !== id) throw normalized;
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      if (idRef.current === id) setCredentialActionPending(null);
    }
  };

  const regenerateCredential = async (applicationKey: string, expectedCredentialRevision: string, reason: string) => {
    assertCurrentServer();
    setCredentialActionPending(`regenerate:${applicationKey}`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: "regenerate", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.regenerateApplication(id, applicationKey, dto, key);
      if (idRef.current !== id) return receipt;
      setLastCredentialReceipt(receipt);
      toast.success("Credential rotated", `${applicationKey} advanced to revision ${receipt.credentialRevision}. The password remains secured inside Core.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      if (idRef.current === id) setCredentialActionPending(null);
    }
  };

  const reconcileCredential = async (applicationKey: string, expectedCredentialRevision: string, reason: string) => {
    assertCurrentServer();
    setCredentialActionPending(`reconcile:${applicationKey}`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: "reconcile", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.reconcileApplication(id, applicationKey, dto, key);
      if (idRef.current !== id) return receipt;
      setLastCredentialReceipt(receipt);
      toast.success("Credential reconciled", `${applicationKey} is ready at revision ${receipt.credentialRevision}.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      if (idRef.current !== id) throw normalizeApiError(err);
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      await readServer(true);
      if (idRef.current !== id) throw normalized;
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      if (idRef.current === id) setCredentialActionPending(null);
    }
  };

  const openRetryBootstrap = () => {
    if (loadedServerId !== id) return;
    setCredentialAction({ kind: "retry-bootstrap" });
    setCredentialActionServerId(id);
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const openSystemCredentialMutation = (
    kind: "regenerate-system" | "reconcile-system",
    binding: DatabaseServerProvisioningPrincipalBindingView,
  ) => {
    if (loadedServerId !== id) return;
    setCredentialAction({
      kind,
      databasePrincipal: binding.databasePrincipal,
      expectedCredentialRevision: binding.credentialRevision,
    });
    setCredentialActionServerId(id);
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const openCredentialMutation = (
    kind: "regenerate" | "reconcile",
    binding: DatabaseServerApplicationBindingView,
  ) => {
    if (loadedServerId !== id) return;
    setCredentialAction({
      kind,
      applicationKey: binding.applicationKey,
      databasePrincipal: binding.databasePrincipal,
      expectedCredentialRevision: binding.credentialRevision,
    });
    setCredentialActionServerId(id);
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const closeCredentialAction = () => {
    if (credentialActionPending) return;
    setCredentialAction(null);
    setCredentialActionServerId(null);
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const submitCredentialAction = async () => {
    if (
      !credentialAction ||
      credentialActionServerId !== id ||
      loadedServerId !== id ||
      idRef.current !== id
    ) return;
    const reason = credentialReason.trim();
    if (reason.length < 8) {
      setCredentialActionError("Enter a reason of at least 8 characters.");
      return;
    }
    setCredentialActionError(null);

    try {
      if (credentialAction.kind === "retry-bootstrap") {
        await retryBootstrap(reason);
      } else if (
        credentialAction.kind === "regenerate-system" ||
        credentialAction.kind === "reconcile-system"
      ) {
        await mutateProvisioningCredential(
          credentialAction.kind,
          credentialAction.expectedCredentialRevision,
          reason,
        );
      } else if (credentialAction.kind === "regenerate") {
        await regenerateCredential(
          credentialAction.applicationKey,
          credentialAction.expectedCredentialRevision,
          reason,
        );
      } else if (credentialAction.kind === "reconcile") {
        await reconcileCredential(
          credentialAction.applicationKey,
          credentialAction.expectedCredentialRevision,
          reason,
        );
      }
    } catch (error) {
      if (idRef.current !== id) return;
      const normalized = normalizeApiError(error);
      setCredentialActionError(normalized);
      return;
    }
    if (idRef.current !== id) return;
    setCredentialAction(null);
    setCredentialActionServerId(null);
    setCredentialReason("");
  };

  const publicCredentialError = typeof credentialActionError === "string" ? null : credentialActionError;

  return {
    server: server?.id === id ? server : null,
    loadedServerId,
    canBootstrapApplication: loadedServerId === id && !isBindingsLoading && !bindingsError,
    refreshError,
    refreshServer,
    bindings,
    history,
    lastCredentialReceipt,
    credentialActionPending,
    credentialAction: credentialActionServerId === id ? credentialAction : null,
    credentialReason,
    credentialActionError: typeof credentialActionError === "string" ? credentialActionError : publicCredentialError?.message ?? null,
    credentialActionErrorCode: publicCredentialError?.errorCode,
    credentialActionCorrelationId: publicCredentialError?.correlationId,
    isLoading,
    error,
    isBindingsLoading,
    bindingsError,
    isHistoryLoading,
    historyError,
    fetchServer,
    fetchBindings,
    fetchHistory,
    updateServer,
    drainServer,
    activateServer,
    offlineServer,
    deleteServer,
    retryBootstrap,
    bootstrapApplication,
    regenerateCredential,
    reconcileCredential,
    updateProvisioningRotationPolicy,
    openRetryBootstrap,
    openSystemCredentialMutation,
    openCredentialMutation,
    closeCredentialAction,
    setCredentialReason,
    submitCredentialAction,
  };
}
