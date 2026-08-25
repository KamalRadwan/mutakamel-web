"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { provisioningFleetApi } from "./api";
import { isUuidV7 } from "./contracts";
import {
  classifyFleetCommandFailure,
  classifyFleetReadFailure,
  deriveProvisioningFleetPermissions,
  isAbortError,
  isFleetActionAllowed,
  shouldRetainFleetIntent,
} from "./model";
import type {
  AttestFleetReportCommand,
  CreateFleetPreviewCommand,
  CreateFleetRolloutCommand,
  FleetCommandView,
  FleetManageAction,
  FleetPage,
  FleetPreview,
  FleetPreviewTenant,
  FleetReport,
  FleetResult,
  FleetRollout,
  FleetRolloutTenant,
  FleetView,
  ManageFleetRolloutCommand,
} from "./types";

type OwnedView<T> = FleetView<T> & { ownerId: string | null };

interface StoredIntent<TResult> {
  ownerId: string;
  fingerprint: string;
  key: string;
  execute: () => Promise<TResult>;
}

const initialCommand = <T,>(): FleetCommandView<T> => ({
  state: "IDLE",
  result: null,
  error: null,
  exactRetryAvailable: false,
  idempotencyKey: null,
});

function idleView<T>(): OwnedView<T> {
  return {
    ownerId: null,
    state: "IDLE",
    data: null,
    error: null,
    isRefreshing: false,
  };
}

function useFleetCommand<TResult>(ownerId: string | null) {
  const [view, setView] = useState<FleetCommandView<TResult>>(
    initialCommand<TResult>,
  );
  const intentRef = useRef<StoredIntent<TResult> | null>(null);
  const ownerRef = useRef(ownerId);

  useEffect(() => {
    ownerRef.current = ownerId;
    intentRef.current = null;
    queueMicrotask(() => setView(initialCommand<TResult>()));
  }, [ownerId]);

  const execute = useCallback(async (intent: StoredIntent<TResult>) => {
    setView({
      state: "PENDING",
      result: null,
      error: null,
      exactRetryAvailable: false,
      idempotencyKey: intent.key,
    });
    try {
      const result = await intent.execute();
      if (ownerRef.current !== intent.ownerId) return null;
      intentRef.current = null;
      setView({
        state: "SUCCESS",
        result,
        error: null,
        exactRetryAvailable: false,
        idempotencyKey: intent.key,
      });
      return result;
    } catch (caught) {
      if (ownerRef.current !== intent.ownerId) return null;
      const error = normalizeApiError(caught);
      const retained = shouldRetainFleetIntent(error);
      if (!retained) intentRef.current = null;
      setView({
        state: classifyFleetCommandFailure(error),
        result: null,
        error,
        exactRetryAvailable: retained,
        idempotencyKey: intent.key,
      });
      return null;
    }
  }, []);

  const submit = useCallback(
    (
      fingerprint: string,
      createRequest: (key: string) => Promise<TResult>,
    ) => {
      if (!ownerId) return Promise.resolve(null);
      let intent = intentRef.current;
      if (
        !intent ||
        intent.ownerId !== ownerId ||
        intent.fingerprint !== fingerprint
      ) {
        const key = generateUUIDv7();
        intent = {
          ownerId,
          fingerprint,
          key,
          execute: () => createRequest(key),
        };
        intentRef.current = intent;
      }
      return execute(intent);
    },
    [execute, ownerId],
  );

  const retryExact = useCallback(() => {
    const intent = intentRef.current;
    return intent ? execute(intent) : Promise.resolve(null);
  }, [execute]);

  const rejectForbidden = useCallback(() => {
    const error = localPermissionError();
    setView({
      state: "FORBIDDEN",
      result: null,
      error,
      exactRetryAvailable: false,
      idempotencyKey: null,
    });
    return Promise.resolve(null);
  }, []);

  const clear = useCallback(() => {
    if (view.state === "PENDING") return;
    if (!view.exactRetryAvailable) intentRef.current = null;
    setView(initialCommand<TResult>());
  }, [view.exactRetryAvailable, view.state]);

  return { view, submit, retryExact, rejectForbidden, clear };
}

export function useFleetDirectory() {
  const { user, isLoading: authLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const permissions = useMemo(
    () => deriveProvisioningFleetPermissions(user),
    [user],
  );
  const [revision, setRevision] = useState(0);
  const [rollouts, setRollouts] = useState<
    OwnedView<FleetResult<FleetRollout[]>>
  >(idleView);
  const previewCommand = useFleetCommand<FleetResult<FleetPreview>>(ownerId);

  useEffect(() => {
    if (authLoading) return;
    if (!ownerId || !permissions.canRead) {
      queueMicrotask(() =>
        setRollouts({
          ...idleView(),
          ownerId,
          state: "FORBIDDEN",
        }),
      );
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      setRollouts((current) => ({
        ...(current.ownerId === ownerId ? current : idleView()),
        ownerId,
        state: "LOADING",
        error: null,
        isRefreshing: current.ownerId === ownerId && current.data !== null,
      }));
      void provisioningFleetApi
        .listRollouts(controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setRollouts({
            ownerId,
            state: result.data.length ? "READY" : "EMPTY",
            data: result,
            error: null,
            isRefreshing: false,
          });
        })
        .catch((caught) => {
          if (controller.signal.aborted || isAbortError(caught)) return;
          const error = normalizeApiError(caught);
          setRollouts((current) => ({
            ...current,
            ownerId,
            state: classifyFleetReadFailure(caught, error),
            error,
            isRefreshing: false,
          }));
        });
    });
    return () => controller.abort();
  }, [authLoading, ownerId, permissions.canRead, revision]);

  const createPreview = useCallback(
    (command: CreateFleetPreviewCommand) => {
      if (!permissions.canCreatePreview) {
        return previewCommand.rejectForbidden();
      }
      const frozen = structuredClone(command);
      return previewCommand.submit(
        JSON.stringify(frozen),
        (key) => provisioningFleetApi.createPreview(frozen, key),
      );
    },
    [permissions.canCreatePreview, previewCommand],
  );

  return {
    authLoading,
    permissions,
    rollouts,
    previewCommand: previewCommand.view,
    createPreview,
    retryPreviewExact: previewCommand.retryExact,
    clearPreviewCommand: previewCommand.clear,
    refresh: () => setRevision((value) => value + 1),
  };
}

export function useFleetPreview(previewId: string) {
  const { user, isLoading: authLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const routeValid = isUuidV7(previewId);
  const permissions = useMemo(
    () => deriveProvisioningFleetPermissions(user),
    [user],
  );
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<OwnedView<FleetResult<FleetPreview>>>(
    idleView,
  );
  const [tenants, setTenants] = useState<
    OwnedView<FleetPage<FleetPreviewTenant>>
  >(idleView);
  const rolloutCommand = useFleetCommand<FleetResult<FleetRollout>>(ownerId);

  useEffect(() => {
    if (authLoading) return;
    if (!routeValid) {
      queueMicrotask(() => {
        setPreview({ ...idleView(), ownerId, state: "INVALID" });
        setTenants({ ...idleView(), ownerId, state: "INVALID" });
      });
      return;
    }
    if (!ownerId || !permissions.canRead) {
      queueMicrotask(() => {
        setPreview({ ...idleView(), ownerId, state: "FORBIDDEN" });
        setTenants({ ...idleView(), ownerId, state: "FORBIDDEN" });
      });
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      startOwned(setPreview, ownerId);
      startOwned(setTenants, ownerId);
      void Promise.allSettled([
        provisioningFleetApi.getPreview(previewId, controller.signal),
        provisioningFleetApi.listPreviewTenants(
          previewId,
          page,
          50,
          controller.signal,
        ),
      ]).then(([previewResult, tenantResult]) => {
        if (controller.signal.aborted) return;
        settleOwned(setPreview, ownerId, previewResult, false);
        settleOwned(setTenants, ownerId, tenantResult, true);
      });
    });
    return () => controller.abort();
  }, [authLoading, ownerId, page, permissions.canRead, previewId, revision, routeValid]);

  const createRollout = useCallback(
    (command: CreateFleetRolloutCommand) => {
      if (!permissions.canCreateRollout) {
        return rolloutCommand.rejectForbidden();
      }
      const frozen = structuredClone(command);
      return rolloutCommand
        .submit(JSON.stringify(frozen), (key) =>
          provisioningFleetApi.createRollout(frozen, key),
        )
        .then((result) => {
          if (result) setRevision((value) => value + 1);
          return result;
        });
    },
    [permissions.canCreateRollout, rolloutCommand],
  );

  return {
    authLoading,
    routeValid,
    permissions,
    preview,
    tenants,
    page,
    setPage,
    rolloutCommand: rolloutCommand.view,
    createRollout,
    retryRolloutExact: rolloutCommand.retryExact,
    clearRolloutCommand: rolloutCommand.clear,
    refresh: () => setRevision((value) => value + 1),
  };
}

export function useFleetRollout(rolloutId: string) {
  const { user, isLoading: authLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const routeValid = isUuidV7(rolloutId);
  const permissions = useMemo(
    () => deriveProvisioningFleetPermissions(user),
    [user],
  );
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [rollout, setRollout] = useState<OwnedView<FleetResult<FleetRollout>>>(
    idleView,
  );
  const [tenants, setTenants] = useState<
    OwnedView<FleetPage<FleetRolloutTenant>>
  >(idleView);
  const [report, setReport] = useState<OwnedView<FleetResult<FleetReport>>>(
    idleView,
  );
  const manageCommand = useFleetCommand<FleetResult<FleetRollout>>(ownerId);
  const attestCommand = useFleetCommand<FleetResult<FleetReport>>(ownerId);

  useEffect(() => {
    if (authLoading) return;
    if (!routeValid) {
      queueMicrotask(() => {
        setRollout({ ...idleView(), ownerId, state: "INVALID" });
        setTenants({ ...idleView(), ownerId, state: "INVALID" });
      });
      return;
    }
    if (!ownerId || !permissions.canRead) {
      queueMicrotask(() => {
        setRollout({ ...idleView(), ownerId, state: "FORBIDDEN" });
        setTenants({ ...idleView(), ownerId, state: "FORBIDDEN" });
      });
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      startOwned(setRollout, ownerId);
      startOwned(setTenants, ownerId);
      void Promise.allSettled([
        provisioningFleetApi.getRollout(rolloutId, controller.signal),
        provisioningFleetApi.listRolloutTenants(
          rolloutId,
          page,
          50,
          controller.signal,
        ),
      ]).then(([rolloutResult, tenantResult]) => {
        if (controller.signal.aborted) return;
        settleOwned(setRollout, ownerId, rolloutResult, false);
        settleOwned(setTenants, ownerId, tenantResult, true);
      });
    });
    return () => controller.abort();
  }, [authLoading, ownerId, page, permissions.canRead, revision, rolloutId, routeValid]);

  useEffect(() => {
    if (authLoading) return;
    if (!routeValid) {
      queueMicrotask(() =>
        setReport({ ...idleView(), ownerId, state: "INVALID" }),
      );
      return;
    }
    if (!ownerId || !permissions.canReadReport) {
      queueMicrotask(() =>
        setReport({ ...idleView(), ownerId, state: "FORBIDDEN" }),
      );
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      startOwned(setReport, ownerId);
      void provisioningFleetApi
        .getReport(rolloutId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setReport({
            ownerId,
            state: "READY",
            data: result,
            error: null,
            isRefreshing: false,
          });
        })
        .catch((caught) => {
          if (controller.signal.aborted || isAbortError(caught)) return;
          const error = normalizeApiError(caught);
          setReport((current) => ({
            ...current,
            ownerId,
            state: classifyFleetReadFailure(caught, error),
            error,
            isRefreshing: false,
          }));
        });
    });
    return () => controller.abort();
  }, [authLoading, ownerId, permissions.canReadReport, revision, rolloutId, routeValid]);

  const manage = useCallback(
    (action: FleetManageAction, command: ManageFleetRolloutCommand) => {
      const current = rollout.data?.data;
      if (
        !permissions.canManage ||
        !current ||
        !isFleetActionAllowed(current.status, action)
      ) {
        return manageCommand.rejectForbidden();
      }
      const frozen = structuredClone(command);
      const fingerprint = JSON.stringify({ rolloutId, action, command: frozen });
      return manageCommand
        .submit(fingerprint, (key) =>
          provisioningFleetApi.manageRollout(
            rolloutId,
            action,
            frozen,
            key,
          ),
        )
        .then((result) => {
          if (result) setRevision((value) => value + 1);
          return result;
        });
    },
    [manageCommand, permissions.canManage, rollout.data, rolloutId],
  );

  const attest = useCallback(
    (command: AttestFleetReportCommand) => {
      if (
        !permissions.canAttest ||
        report.data?.data.status !== "READY_FOR_ATTESTATION"
      ) {
        return attestCommand.rejectForbidden();
      }
      const frozen = structuredClone(command);
      const fingerprint = JSON.stringify({ rolloutId, command: frozen });
      return attestCommand
        .submit(fingerprint, (key) =>
          provisioningFleetApi.attestReport(rolloutId, frozen, key),
        )
        .then((result) => {
          if (result) setRevision((value) => value + 1);
          return result;
        });
    },
    [attestCommand, permissions.canAttest, report.data, rolloutId],
  );

  return {
    authLoading,
    routeValid,
    permissions,
    rollout,
    tenants,
    report,
    page,
    setPage,
    manageCommand: manageCommand.view,
    attestCommand: attestCommand.view,
    manage,
    retryManageExact: manageCommand.retryExact,
    clearManageCommand: manageCommand.clear,
    attest,
    retryAttestExact: attestCommand.retryExact,
    clearAttestCommand: attestCommand.clear,
    refresh: () => setRevision((value) => value + 1),
  };
}

function startOwned<T>(
  setView: React.Dispatch<React.SetStateAction<OwnedView<T>>>,
  ownerId: string,
): void {
  setView((current) => ({
    ...(current.ownerId === ownerId ? current : idleView()),
    ownerId,
    state: "LOADING",
    error: null,
    isRefreshing: current.ownerId === ownerId && current.data !== null,
  }));
}

function settleOwned<T>(
  setView: React.Dispatch<React.SetStateAction<OwnedView<T>>>,
  ownerId: string,
  result: PromiseSettledResult<T>,
  emptyWhenItems: boolean,
): void {
  if (result.status === "fulfilled") {
    const isEmpty =
      emptyWhenItems &&
      typeof result.value === "object" &&
      result.value !== null &&
      "items" in result.value &&
      Array.isArray((result.value as { items: unknown }).items) &&
      (result.value as { items: unknown[] }).items.length === 0;
    setView({
      ownerId,
      state: isEmpty ? "EMPTY" : "READY",
      data: result.value,
      error: null,
      isRefreshing: false,
    });
    return;
  }
  if (isAbortError(result.reason)) return;
  const error = normalizeApiError(result.reason);
  setView((current) => ({
    ...current,
    ownerId,
    state: classifyFleetReadFailure(result.reason, error),
    error,
    isRefreshing: false,
  }));
}

function localPermissionError(): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 403,
    errorCode: "ADMIN_PERMISSION_REQUIRED",
    errorCategory: "AUTHORIZATION",
    message: "The current operator is not authorized for this command.",
  };
}

