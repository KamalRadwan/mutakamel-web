"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";

export interface OpportunityTag {
  id: string;
  name: string;
}

function parseOpportunityTags(payload: unknown): OpportunityTag[] {
  if (!Array.isArray(payload) || payload.length > 500) {
    throw new Error("Invalid CRM tags response.");
  }
  const tags = payload.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid CRM tags response.");
    }
    const record = value as Record<string, unknown>;
    if (!isUUIDv7(record.id) || typeof record.name !== "string" || !record.name.trim()) {
      throw new Error("Invalid CRM tags response.");
    }
    return { id: record.id, name: record.name };
  });
  if (new Set(tags.map(({ id }) => id)).size !== tags.length) {
    throw new Error("Invalid CRM tags response.");
  }
  return tags;
}

export function useOpportunityTags(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = hasPermission(user?.permissions ?? [], "crm.tags.read");
  const shouldLoad = enabled && canRead;
  const [items, setItems] = useState<OpportunityTag[]>([]);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setDegraded(false);
      void axiosClient
        .get<unknown>("/api/tenant/crm/v1/tags", {
          signal: controller.signal,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((response) => {
          const next = parseOpportunityTags(response.data);
          if (!controller.signal.aborted) setItems(next);
        })
        .catch(() => {
          if (!controller.signal.aborted) setDegraded(true);
        });
    });
    return () => controller.abort();
  }, [shouldLoad]);

  return { items, canRead, degraded: shouldLoad && degraded };
}
