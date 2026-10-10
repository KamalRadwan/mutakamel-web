"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { provisioningGovernanceApi } from "@/features/admin/provisioning-governance/api";
import type { ProvisioningComponent } from "@/features/admin/provisioning-governance/types";
import { adminCan } from "@/lib/auth/rbac";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import {
  releaseComponentCatalogue,
  type ReleaseComponentCatalogue,
} from "../model/release-standing";

export type ReleaseCatalogueState =
  | "LOADING"
  | "READY"
  | "FORBIDDEN"
  | "UNAVAILABLE";

/** The active catalogue is a handful of components; this only bounds a fault. */
const MAX_CATALOGUE_PAGES = 10;

/**
 * The provisioning component catalogue, read to tell current releases from
 * superseded ones (see `releaseCatalogueStanding`).
 *
 * The read needs `admin.tenants.read`, which the release-governance
 * permissions do not imply. Without it, or when the read fails, every release
 * stands `UNKNOWN` and the screen still works. `refreshKey` reloads it with
 * the screen's own refresh; `enabled` is the screen's own read permission, so
 * nothing is read for a screen that shows nothing.
 */
export function useReleaseCatalogue(
  refreshKey: number,
  enabled: boolean,
): {
  state: ReleaseCatalogueState;
  catalogue: ReleaseComponentCatalogue | null;
} {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = enabled && adminCan(user, "admin.tenants.read");
  const [result, setResult] = useState<{
    state: Exclude<ReleaseCatalogueState, "LOADING">;
    catalogue: ReleaseComponentCatalogue | null;
  } | null>(null);

  useEffect(() => {
    if (isAuthLoading || !canRead) return;
    const controller = new AbortController();
    void readAllComponents(controller.signal)
      .then((components) => {
        if (controller.signal.aborted) return;
        setResult({
          state: "READY",
          catalogue: releaseComponentCatalogue(components),
        });
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResult({
          state:
            normalizeApiError(caught).httpStatus === 403
              ? "FORBIDDEN"
              : "UNAVAILABLE",
          catalogue: null,
        });
      });
    return () => controller.abort();
  }, [canRead, isAuthLoading, refreshKey]);

  const state: ReleaseCatalogueState = isAuthLoading
    ? "LOADING"
    : !canRead
      ? "FORBIDDEN"
      : (result?.state ?? "LOADING");
  return {
    state,
    catalogue: state === "READY" ? (result?.catalogue ?? null) : null,
  };
}

async function readAllComponents(
  signal: AbortSignal,
): Promise<ProvisioningComponent[]> {
  const components: ProvisioningComponent[] = [];
  for (let page = 1; page <= MAX_CATALOGUE_PAGES; page += 1) {
    const result = await provisioningGovernanceApi.listComponents(
      { page, limit: 100, sortBy: "key", sortDir: "ASC" },
      signal,
    );
    components.push(...result.items);
    if (!result.hasNext) break;
  }
  return components;
}
