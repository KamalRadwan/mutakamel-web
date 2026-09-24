"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  type CrmTag,
} from "../../shared/tag-contract";

/** Catalogue state for the atomic Create Lead form. */
export function useCreateLeadTags(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = hasPermission(user?.permissions ?? [], "crm.tags.read");
  const canManage = hasPermission(user?.permissions ?? [], "crm.tags.manage");
  const shouldLoad = enabled && canRead;
  const [items, setItems] = useState<CrmTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  function addTag(tag: CrmTag) {
    setItems((prev) => {
      if (prev.some((item) => item.id.toLowerCase() === tag.id.toLowerCase())) return prev;
      return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setDegraded(false);
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, {
          signal: controller.signal,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((response) => {
          const next = parseCrmTagCatalogue(response.data);
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
    canManage,
    isLoading: shouldLoad && isLoading,
    degraded: shouldLoad && degraded,
    addTag,
  };
}
