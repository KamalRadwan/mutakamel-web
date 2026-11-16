"use client";
import { useEffect, useState } from "react";
import type { PriceBookVersionDiff } from "../../pricing-contract";
import type { TemporalVersionInput } from "../../version-temporal";

export function useVersionComparison(versionId: string, versions: readonly TemporalVersionInput[], diff: PriceBookVersionDiff | null, load: (baselineId: string) => Promise<void>) {
  const siblingVersions = versions.filter(version => version.id !== versionId);
  const [selectedBaselineId, setSelectedBaselineId] = useState(siblingVersions[0]?.id ?? "");
  const activeBaselineId = siblingVersions.some(version => version.id === selectedBaselineId) ? selectedBaselineId : siblingVersions[0]?.id ?? "";
  useEffect(() => {
    if (!activeBaselineId || (diff?.targetVersion.id === versionId && diff.baselineVersion.id === activeBaselineId)) return;
    void load(activeBaselineId);
  }, [activeBaselineId, versionId, diff, load]);
  return { siblingVersions, activeBaselineId, setSelectedBaselineId };
}
