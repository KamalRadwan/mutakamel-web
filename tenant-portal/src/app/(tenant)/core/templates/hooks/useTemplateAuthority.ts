"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { subscribeToTenantAuthEvents, subscribeToTenantAuthLifecycle } from "@/lib/auth/sessionCoordinator";

export function templateRequestFence(isCurrent: () => boolean) {
  return () => {
    if (!isCurrent()) throw new DOMException("Templates request retired", "AbortError");
  };
}

function subscribeTemplateTiming(listener: () => void) {
  // The owner publishes its event before storing the paired session metadata.
  const schedule = () => queueMicrotask(listener);
  const stopEvents = subscribeToTenantAuthEvents(schedule);
  const stopLifecycle = subscribeToTenantAuthLifecycle(schedule);
  return () => { stopEvents(); stopLifecycle(); };
}

const noServerRevision = () => null;

export function useTemplateAuthority() {
  const { user, authState, readReadyProfileCommit, subscribeProfileReadiness, recoverTemplateProfile } = useTenantAuth();
  const recovery = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const readCurrent = useCallback(() => {
    const commit = readReadyProfileCommit();
    return commit?.sessionRevision ? JSON.stringify([commit.user.id, commit.sessionRevision, commit.sequence]) : null;
  }, [readReadyProfileCommit]);
  const subscribe = useCallback((listener: () => void) => {
    const stopProfile = subscribeProfileReadiness(listener);
    const stopTiming = subscribeTemplateTiming(listener);
    return () => { stopProfile(); stopTiming(); };
  }, [subscribeProfileReadiness]);
  const observed = useSyncExternalStore(subscribe, readCurrent, noServerRevision);
  const key = user && readReadyProfileCommit()?.user === user ? observed : null;

  const canRetry = !recovering && (authState === "AUTHENTICATED" || authState === "DEGRADED");
  const retry = async () => {
    if (!canRetry || recovery.current || readCurrent() !== null) return;
    recovery.current = true;
    setRecovering(true);
    try {
      await recoverTemplateProfile();
    } catch {
      // The auth owner handles recovery failures and keeps readiness held.
    } finally {
      recovery.current = false;
      setRecovering(false);
    }
  };
  return { key, readCurrent, subscribe, retry, canRetry, recovering };
}
