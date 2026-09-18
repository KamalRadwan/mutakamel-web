"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { isUUIDv7 } from "@/lib/uuid";
import type { EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { auditReferencePermission, readAuditReferenceLabel, type AuditValueLabels } from "@/lib/audit/reference-labels";

/** Resolve non-person foreign keys; supplied catalog labels (e.g. stages) win. */
export function useAuditReferenceLabels(events: readonly EntityAuditEvent[], provided: AuditValueLabels | undefined, enabled: boolean, refreshToken?: object | number) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { lang, t } = useI18n();
  const permissions = user?.permissions ?? [];
  const keys = [...new Set(events.flatMap((event) => event.changes.flatMap((change) => {
    const permission = auditReferencePermission(change.field);
    return permission && permissions.includes(permission) ? [change.before, change.after].flat()
      .filter(isUUIDv7).filter((id) => !provided?.[change.field]?.[id]).map((id) => `${change.field}:${id}`) : [];
  })))].sort().join(",");
  const scope = JSON.stringify([enabled, lang, user?.id, realtimeAuthGeneration, permissions, user?.accessibleBranches, user?.accessibleCompanies, user?.teamMemberships]);
  const cache = useRef<{ scope: string; refreshToken?: object | number; entries: Map<string, string | null> }>({ scope: "", entries: new Map() });
  const [snapshot, setSnapshot] = useState<{ scope: string; refreshToken?: object | number; entries: ReadonlyMap<string, string | null> }>({ scope: "", entries: new Map() });

  useEffect(() => {
    const controller = new AbortController();
    if (cache.current.scope !== scope || cache.current.refreshToken !== refreshToken) cache.current = { scope, refreshToken, entries: new Map() };
    const entries = cache.current.entries;
    const pending = enabled && keys ? keys.split(",").filter((key) => !entries.has(key)) : [];
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setSnapshot({ scope, refreshToken, entries: new Map(entries) });
      let index = 0;
      const worker = async () => {
        while (!controller.signal.aborted && index < pending.length) {
          const key = pending[index++];
          const [field, id] = key.split(":");
          let label: string | null = null;
          try { label = await readAuditReferenceLabel(field, id, lang, controller.signal); }
          catch { /* The diff remains readable even when one reference is inaccessible. */ }
          if (controller.signal.aborted) return;
          entries.set(key, label);
          setSnapshot({ scope, refreshToken, entries: new Map(entries) });
        }
      };
      void Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
    });
    return () => controller.abort();
  }, [enabled, keys, lang, refreshToken, scope]);

  const labels: Record<string, Record<string, string>> = {};
  if (enabled && snapshot.scope === scope && snapshot.refreshToken === refreshToken) {
    for (const [key, name] of snapshot.entries) {
      const [field, id] = key.split(":");
      (labels[field] ??= {})[id] = name || t.audit.valueUnavailable;
    }
  }
  for (const [field, values] of Object.entries(provided ?? {})) labels[field] = { ...labels[field], ...values };
  return labels;
}
