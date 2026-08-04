import { useState, useCallback, useEffect } from "react";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
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

  const [server, setServer] = useState<DatabaseServerView | null>(null);
  const [bindings, setBindings] = useState<DatabaseServerApplicationBindingView[]>([]);
  const [history, setHistory] = useState<DatabaseServerHistoryView[]>([]);
  const [lastCredentialReceipt, setLastCredentialReceipt] = useState<
    ApplicationCredentialBootstrapReceipt | ApplicationCredentialMutationReceipt | DatabaseServerSystemCredentialMutationReceipt | null
  >(null);
  const [credentialActionPending, setCredentialActionPending] = useState<string | null>(null);
  const [credentialAction, setCredentialAction] = useState<DatabaseCredentialAction | null>(null);
  const [credentialReason, setCredentialReason] = useState("");
  const [credentialActionError, setCredentialActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBindingsLoading, setIsBindingsLoading] = useState(false);
  const [bindingsError, setBindingsError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchBindings = useCallback(async () => {
    setIsBindingsLoading(true);
    setBindingsError(null);
    try {
      setBindings(await databaseServersApi.listApplications(id));
    } catch (requestError) {
      setBindingsError(normalizeApiError(requestError).message);
    } finally {
      setIsBindingsLoading(false);
    }
  }, [id]);

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await databaseServersApi.getHistory(id));
    } catch (requestError) {
      setHistoryError(normalizeApiError(requestError).message);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [id]);

  const fetchServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await databaseServersApi.get(id);
      setServer(data);
      await Promise.all([fetchBindings(), fetchHistory()]);
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error("Error", normalized.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBindings, fetchHistory, id, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServer();
  }, [fetchServer]);

  const updateServer = (dto: UpdateDatabaseServerDto) =>
    mutate(
      dto,
      (key) => databaseServersApi.update(id, dto, key),
      { onSuccessMessage: "Database Server updated successfully.", onSuccess: fetchServer }
    );

  const drainServer = () =>
    mutate(
      { action: "drain" },
      (key) => databaseServersApi.drain(id, key),
      { onSuccessMessage: "Server drained.", onSuccess: fetchServer }
    );

  const activateServer = () =>
    mutate(
      { action: "activate" },
      (key) => databaseServersApi.activate(id, key),
      { onSuccessMessage: "Server activated.", onSuccess: fetchServer }
    );

  const offlineServer = () =>
    mutate(
      { action: "offline" },
      (key) => databaseServersApi.offline(id, key),
      { onSuccessMessage: "Server offline.", onSuccess: fetchServer }
    );

  const deleteServer = () =>
    mutate(
      { action: "delete" },
      (key) => databaseServersApi.delete(id, key),
      { onSuccessMessage: "Server deleted." }
    );

  // Credential Commands

  const retryBootstrap = async (reason: string) => {
    setCredentialActionPending("retry-bootstrap");
    try {
      const dto: BootstrapDatabaseServerApplicationsDto = { reason };
      const key = getIdempotencyKey({ action: "retry-bootstrap", id, ...dto });
      const updated = await databaseServersApi.retryBootstrap(id, dto, key);
      setServer(updated);
      toast.success("Registration setup retried", `${updated.credentialBootstrap.readyPrincipals}/${updated.credentialBootstrap.totalPrincipals} required access bindings are ready.`);
      resetKey();
      await fetchServer();
      return updated;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setCredentialActionPending(null);
    }
  };

  const mutateProvisioningCredential = async (
    kind: "regenerate-system" | "reconcile-system",
    expectedCredentialRevision: string,
    reason: string,
  ) => {
    setCredentialActionPending(`${kind}:PROVISIONING`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: kind, id, purpose: "PROVISIONING", ...dto });
      const receipt = kind === "regenerate-system"
        ? await databaseServersApi.regenerateProvisioningPrincipal(id, dto, key)
        : await databaseServersApi.reconcileProvisioningPrincipal(id, dto, key);
      setLastCredentialReceipt(receipt);
      toast.success("Provisioning credential ready", `${receipt.databasePrincipal} advanced to revision ${receipt.credentialRevision}.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setCredentialActionPending(null);
    }
  };

  const updateProvisioningRotationPolicy = async (
    dto: UpdateDatabaseServerSystemPrincipalRotationDto,
  ) => {
    const key = getIdempotencyKey({ action: "provisioning-rotation-policy", id, ...dto });
    try {
      const updated = await databaseServersApi.updateProvisioningRotationPolicy(id, dto, key);
      toast.success("Rotation policy updated", `${updated.databasePrincipal} now uses the saved maintenance-aware schedule.`);
      resetKey();
      await fetchServer();
      return updated;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    }
  };

  const bootstrapApplication = async (applicationKey: string, expectedCatalogueRevision: string, expectedPolicyRevision: string, reason: string) => {
    setCredentialActionPending(`bootstrap:${applicationKey}`);
    try {
      const dto: BootstrapDatabaseServerApplicationDto = { expectedCatalogueRevision, expectedPolicyRevision, reason };
      const key = getIdempotencyKey({ action: "bootstrap-application", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.bootstrapApplication(id, applicationKey, dto, key);
      setLastCredentialReceipt(receipt);
      toast.success("Application access ready", `${applicationKey} was verified. Its password was not disclosed to the browser.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setCredentialActionPending(null);
    }
  };

  const regenerateCredential = async (applicationKey: string, expectedCredentialRevision: string, reason: string) => {
    setCredentialActionPending(`regenerate:${applicationKey}`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: "regenerate", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.regenerateApplication(id, applicationKey, dto, key);
      setLastCredentialReceipt(receipt);
      toast.success("Credential rotated", `${applicationKey} advanced to revision ${receipt.credentialRevision}. The password remains secured inside Core.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setCredentialActionPending(null);
    }
  };

  const reconcileCredential = async (applicationKey: string, expectedCredentialRevision: string, reason: string) => {
    setCredentialActionPending(`reconcile:${applicationKey}`);
    try {
      const dto: ApplicationDatabaseCredentialCommandDto = { expectedCredentialRevision, reason };
      const key = getIdempotencyKey({ action: "reconcile", id, applicationKey, ...dto });
      const receipt = await databaseServersApi.reconcileApplication(id, applicationKey, dto, key);
      setLastCredentialReceipt(receipt);
      toast.success("Credential reconciled", `${applicationKey} is ready at revision ${receipt.credentialRevision}.`);
      resetKey();
      await fetchServer();
      return receipt;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setCredentialActionPending(null);
    }
  };

  const openRetryBootstrap = () => {
    setCredentialAction({ kind: "retry-bootstrap" });
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const openSystemCredentialMutation = (
    kind: "regenerate-system" | "reconcile-system",
    binding: DatabaseServerProvisioningPrincipalBindingView,
  ) => {
    setCredentialAction({
      kind,
      databasePrincipal: binding.databasePrincipal,
      expectedCredentialRevision: binding.credentialRevision,
    });
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const openCredentialMutation = (
    kind: "regenerate" | "reconcile",
    binding: DatabaseServerApplicationBindingView,
  ) => {
    setCredentialAction({
      kind,
      applicationKey: binding.applicationKey,
      databasePrincipal: binding.databasePrincipal,
      expectedCredentialRevision: binding.credentialRevision,
    });
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const closeCredentialAction = () => {
    if (credentialActionPending) return;
    setCredentialAction(null);
    setCredentialReason("");
    setCredentialActionError(null);
  };

  const submitCredentialAction = async () => {
    if (!credentialAction) return;
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
      const normalized = normalizeApiError(error);
      setCredentialActionError(normalized.message);
      return;
    }
    setCredentialAction(null);
    setCredentialReason("");
  };

  return {
    server,
    bindings,
    history,
    lastCredentialReceipt,
    credentialActionPending,
    credentialAction,
    credentialReason,
    credentialActionError,
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
