"use client";

import { useEffect, useRef, useState } from "react";
import {
  isTerminalOperationStatus,
  type TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import type { UpdatesReadFailure } from "./useProvisioningOperationTracker";

export const OPERATION_MODAL_POLL_INTERVAL_MS = 5_000;
export const MAX_OPERATION_MODAL_POLLS = 12;

interface UseOperationModalPollingParams {
  canReadEffective: boolean;
  scopeFenceKey: string;
  isOpen: boolean;
  modalSessionId: number;
  activeOperation: TenantProvisioningOperationView | null;
  isCheckingOperation: boolean;
  operationFailure: UpdatesReadFailure | null;
  onPoll: (operationId: string) => Promise<void>;
  onStopInFlight: () => void;
}

function isDocumentCurrentlyVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useOperationModalPolling({
  canReadEffective,
  scopeFenceKey,
  isOpen,
  modalSessionId,
  activeOperation,
  isCheckingOperation,
  operationFailure,
  onPoll,
  onStopInFlight,
}: UseOperationModalPollingParams): void {
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(isDocumentCurrentlyVisible);

  const pollCountRef = useRef(0);
  const sessionKeyRef = useRef("");
  const autoPollInFlightRef = useRef(false);
  const isCheckingRef = useRef(isCheckingOperation);
  const onPollRef = useRef(onPoll);
  const onStopInFlightRef = useRef(onStopInFlight);

  useEffect(() => {
    isCheckingRef.current = isCheckingOperation;
    if (!isCheckingOperation) {
      autoPollInFlightRef.current = false;
    }
  }, [isCheckingOperation]);

  useEffect(() => {
    onPollRef.current = onPoll;
    onStopInFlightRef.current = onStopInFlight;
  }, [onPoll, onStopInFlight]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsDocumentVisible(visible);
      if (!visible && autoPollInFlightRef.current) {
        autoPollInFlightRef.current = false;
        onStopInFlightRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const operationId = activeOperation?.id ?? null;
  const sessionKey =
    canReadEffective && isOpen && operationId
      ? `${scopeFenceKey}:${modalSessionId}:${operationId}`
      : "";

  useEffect(() => {
    if (sessionKeyRef.current !== sessionKey) {
      sessionKeyRef.current = sessionKey;
      pollCountRef.current = 0;
      if (autoPollInFlightRef.current) {
        autoPollInFlightRef.current = false;
        onStopInFlightRef.current();
      }
    }
  }, [sessionKey]);

  const shouldSchedulePoll =
    canReadEffective &&
    isOpen &&
    isDocumentVisible &&
    activeOperation !== null &&
    !isTerminalOperationStatus(activeOperation.status) &&
    operationFailure === null &&
    !isCheckingOperation;

  useEffect(() => {
    if (
      !shouldSchedulePoll ||
      !operationId ||
      pollCountRef.current >= MAX_OPERATION_MODAL_POLLS
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (
        !isDocumentCurrentlyVisible() ||
        isCheckingRef.current ||
        pollCountRef.current >= MAX_OPERATION_MODAL_POLLS
      ) {
        return;
      }
      pollCountRef.current += 1;
      autoPollInFlightRef.current = true;
      void onPollRef.current(operationId);
    }, OPERATION_MODAL_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    activeOperation?.status,
    activeOperation?.updatedAt,
    isCheckingOperation,
    isDocumentVisible,
    isOpen,
    modalSessionId,
    operationFailure,
    operationId,
    scopeFenceKey,
    shouldSchedulePoll,
  ]);
}
