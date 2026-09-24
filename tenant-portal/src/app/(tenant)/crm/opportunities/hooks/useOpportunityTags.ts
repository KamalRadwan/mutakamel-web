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

export function useOpportunityTags(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = hasPermission(user?.permissions ?? [], "crm.tags.read");
  const shouldLoad = enabled && canRead;
  const [items, setItems] = useState<CrmTag[]>([]);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
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
          if (!controller.signal.aborted) setDegraded(true);
        });
    });
    return () => controller.abort();
  }, [shouldLoad]);

  return { items, canRead, degraded: shouldLoad && degraded };
}
