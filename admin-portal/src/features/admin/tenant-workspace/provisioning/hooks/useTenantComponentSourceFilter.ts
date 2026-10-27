"use client";

import { useState } from "react";
import {
  TENANT_COMPONENT_SELECTION_SOURCES,
  type TenantComponentInstallation,
} from "../types";

export function useTenantComponentSourceFilter(
  installations: TenantComponentInstallation[],
) {
  const [selectionSource, setSelectionSource] = useState<
    TenantComponentInstallation["selectionSource"] | "ALL"
  >("ALL");

  return {
    selectionSource,
    setSelectionSource: (value: string) => setSelectionSource(
      TENANT_COMPONENT_SELECTION_SOURCES.find((source) => source === value) ?? "ALL",
    ),
    components: selectionSource === "ALL"
      ? installations
      : installations.filter((component) => component.selectionSource === selectionSource),
  };
}
