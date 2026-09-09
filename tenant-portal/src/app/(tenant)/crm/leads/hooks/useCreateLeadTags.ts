"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseLeadTags, type LeadTag } from "../lead-card-contract";

const TAGS_PATH = "/api/tenant/crm/v1/tags";
// crm-app/src/crm/tags/tags.service.ts — live tag ceiling per tenant.
const TAG_CATALOGUE_LIMIT = 500;

function invalidTagsResponse(): never {
  throw new Error("Invalid CRM tags response.");
}

/** Runtime boundary for CRM's raw, tenant-wide tag catalogue. */
export function parseLeadTagArray(payload: unknown): LeadTag[] {
  if (!Array.isArray(payload) || payload.length > TAG_CATALOGUE_LIMIT) {
    invalidTagsResponse();
  }
  const tags = parseLeadTags(payload);
  if (
    new Set(tags.map(({ id }) => id.toLowerCase())).size !== tags.length ||
    // class-validator and varchar count Unicode code points, not UTF-16 units.
    tags.some(({ name }) => name.trim().length === 0 || [...name].length > 60)
  ) {
    invalidTagsResponse();
  }
  return tags;
}

/** Catalogue state for the atomic Create Lead form. */
export function useCreateLeadTags(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = hasPermission(user?.permissions ?? [], "crm.tags.read");
  const shouldLoad = enabled && canRead;
  const [items, setItems] = useState<LeadTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setDegraded(false);
      void axiosClient
        .get<unknown>(TAGS_PATH, {
          signal: controller.signal,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((response) => {
          const next = parseLeadTagArray(response.data);
          if (!controller.signal.aborted) setItems(next);
        })
        .catch(() => {
          // Retain any already validated items so selected chips stay named
          // and removable during a transient catalogue failure.
          if (!controller.signal.aborted) setDegraded(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [shouldLoad]);

  return {
    items,
    canRead,
    isLoading: shouldLoad && isLoading,
    degraded: shouldLoad && degraded,
  };
}
