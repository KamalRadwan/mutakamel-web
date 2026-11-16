"use client";
import { useEffect, useRef, useState } from "react";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";
import { readZoneSetup, updateZones, type ZoneEdit } from "../zone-flow-commands";
import { usePageFormEligibility } from "./usePageFormEligibility";
export function useZoneSetup(controller: PageController, base: EditorDocument, close: () => void) {
  const [setup, setSetup] = useState(() => readZoneSetup(base));
  const [heights, setHeights] = useState(() => ({ header: String(setup.header.heightMm), footer: String(setup.footer.heightMm) }));
  const [invalid, setInvalid] = useState<string[]>([]);
  const summary = useRef<HTMLDivElement>(null);
  const { editable, canMutate, guard, finishApply, failure } = usePageFormEligibility(controller, base);
  useEffect(() => { if (invalid.length) summary.current?.focus(); }, [invalid]);
  const patch = guard((type: "header" | "footer", value: Partial<ZoneEdit>) => setSetup(current => ({ ...current, [type]: { ...current[type], ...value } })));
  const height = guard((type: "header" | "footer", text: string) => { setHeights(current => ({ ...current, [type]: text })); setInvalid(current => current.filter(key => key !== type)); });
  const numeric = (type: "header" | "footer") => heights[type].trim() ? Number(heights[type]) : NaN;
  const apply = () => {
    if (!canMutate()) return;
    const errors = (["header", "footer"] as const).filter(type => setup[type].enabled && (!Number.isFinite(numeric(type)) || numeric(type) < 1 || numeric(type) > 80));
    setInvalid(errors); if (errors.length) return;
    const next = { header: { ...setup.header, heightMm: numeric("header") }, footer: { ...setup.footer, heightMm: numeric("footer") } };
    const changed = controller.setZones(next, base);
    finishApply(changed, () => JSON.stringify(updateZones(base, next)) === JSON.stringify(base), close);
  };
  const bodyHeight = base.page ? base.page.heightMm - base.page.marginMm.top - base.page.marginMm.bottom -
    (setup.header.enabled ? numeric("header") : 0) - (setup.footer.enabled ? numeric("footer") : 0) : NaN;
  return { editable, setup, heights, patch, height, invalid, summary, apply, bodyHeight, error: failure };
}
