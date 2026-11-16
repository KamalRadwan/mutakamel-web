"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { resolveOrganizationScope } from "@/lib/api/organization-scope";
import { can } from "@/lib/auth/permission-scope";
import type { TemplateVersionReadScope } from "../../template-lifecycle-api";
import { TEMPLATE_READ_PERMISSION, type TemplateDetail } from "../../templates-contract";

interface VersionAuthoritySnapshot {
  readonly key: string;
  readonly scope: TemplateVersionReadScope;
}

export interface VersionAuthority extends VersionAuthoritySnapshot {
  /** Live recheck for effects, handlers and request settlement. */
  isCurrent(): boolean;
  onRetire(listener: () => void): () => void;
}

function createVersionOwner(snapshot: VersionAuthoritySnapshot, isProfileCurrent: () => boolean) {
  let active = false;
  const listeners = new Set<() => void>();
  const isCurrent = () => active && isProfileCurrent();
  const authority: VersionAuthority = {
    ...snapshot,
    isCurrent,
    onRetire(listener) {
      if (!isCurrent()) listener();
      else listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return {
    authority,
    activate() { active = true; },
    retire() {
      active = false;
      listeners.forEach(listener => listener());
      listeners.clear();
    },
  };
}

const noReadyProfile = () => null;

export function useTemplateVersionAuthority(definitionId: string, template: TemplateDetail | null) {
  const { user, authState, readReadyProfileCommit, subscribeProfileReadiness, recoverTemplateProfile } = useTenantAuth();
  const retrying = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const ready = useSyncExternalStore(subscribeProfileReadiness, readReadyProfileCommit, noReadyProfile);
  const currentTemplate = template?.id === definitionId ? template : null;
  const scope = currentTemplate?.scope;
  const locale = currentTemplate?.locale;
  const companyId = scope?.companyId ?? null;
  const branchId = scope?.branchId ?? null;
  const target = scope?.type === "TENANT" && !companyId && !branchId ? { companyId: null }
    : scope?.type === "COMPANY" && companyId && !branchId ? { companyId }
    : scope?.type === "BRANCH" && companyId && branchId ? { companyId, branchId } : null;
  const headers = useMemo(() => resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", { companyId, branchId }), [companyId, branchId]);
  const qualified = !recovering && authState === "AUTHENTICATED" && ready !== null && ready.user === user;
  const allowed = target !== null && headers.ok && can(ready?.user, TEMPLATE_READ_PERMISSION, target);
  const key = qualified && allowed
    ? JSON.stringify([ready.user.id, ready.sessionRevision, ready.sequence,
      definitionId, scope?.type, companyId, branchId, currentTemplate?.definitionRevision, locale])
    : null;
  const owned = useMemo(() => {
    if (!key || !headers.ok || !locale) return null;
    return createVersionOwner(
      { key, scope: { headers: headers.headers, locale } },
      () => readReadyProfileCommit() === ready,
    );
  }, [headers, key, locale, readReadyProfileCommit, ready]);
  useLayoutEffect(() => {
    if (!owned) return;
    owned.activate();
    const retireIfStale = () => { if (!owned.authority.isCurrent()) owned.retire(); };
    const stop = subscribeProfileReadiness(retireIfStale);
    retireIfStale();
    return () => { stop(); owned.retire(); };
  }, [owned, subscribeProfileReadiness]);

  const canRetry = !recovering && !!user && (authState === "AUTHENTICATED" || authState === "DEGRADED");
  const retry = async () => {
    if (!canRetry || retrying.current || readReadyProfileCommit() !== null) return;
    retrying.current = true;
    setRecovering(true);
    try {
      await recoverTemplateProfile();
    } catch {
      // The auth coordinator owns terminal and degraded outcomes.
    } finally {
      retrying.current = false;
      setRecovering(false);
    }
  };
  // Render from the nullable owner identity derived from the readiness snapshot.
  return { authority: owned?.authority ?? null, denied: qualified && !allowed, canRetry, recovering, retry };
}

export function useVersionHistoryFocus(fallback: RefObject<HTMLDivElement | null>) {
  return useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    return () => {
      const document = node.ownerDocument;
      if (!node.contains(document.activeElement)) return;
      queueMicrotask(() => {
        const target = fallback.current;
        const active = document.activeElement;
        if (target?.isConnected && target.ownerDocument === document &&
          (!active || active === document.body || node.contains(active))) target.focus();
      });
    };
  }, [fallback]);
}
