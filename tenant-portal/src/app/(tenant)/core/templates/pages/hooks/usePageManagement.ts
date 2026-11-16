"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";
import type { RemovalReview } from "../page-contract";
import { copiedPageName, pageCopies, pageNumberLocales, pageText } from "../page-copy";
import { canPaginateFlowNode } from "../zone-flow-commands";

export function usePageManagement(controller: PageController, locale: "ar-EG" | "en-US") {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [setup, setSetup] = useState<{ base: EditorDocument; pageId?: string } | null>(null);
  const [zoneBase, setZoneBase] = useState<EditorDocument | null>(null);
  const [removal, setRemoval] = useState<RemovalReview | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const copy = pageCopies[locale], number = new Intl.NumberFormat(pageNumberLocales[locale]);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state.error]);
  const document = state.document, fixed = document?.layoutMode === "FIXED_CANVAS";
  const flow = document?.layoutMode === "FLOW_DOCUMENT" || document?.layoutMode === "HYBRID_DOCUMENT";
  const explicit = fixed && Array.isArray(document?.canvasPages);
  const active = state.pages[state.activeIndex];
  const selected = state.selectedId ? document?.nodes[state.selectedId] : undefined;
  const paginationSelected = document && selected && canPaginateFlowNode(document, selected.id) ? selected : null;
  return { state, document, copy, errorRef, fixed, flow, explicit, active, selected, paginationSelected, setup, zoneBase, removal,
    status: state.pages.length ? pageText(copy, number.format(state.activeIndex + 1), number.format(state.pages.length)) : copy.generatedUnavailable,
    pageLabel: (index: number) => `${copy.page} ${number.format(index + 1)}`,
    openSetup: () => { if (document) { controller.clearError(); setSetup({ base: document, pageId: explicit ? active?.key : undefined }); } },
    closeSetup: () => setSetup(null),
    openZones: () => { if (document) { controller.clearError(); setZoneBase(document); } },
    closeZones: () => setZoneBase(null),
    add: () => { if (active) controller.addPage(active.key, `${copy.page} ${number.format(state.pages.length + 1)}`); },
    duplicate: () => { if (active) controller.duplicatePage(active.key, copiedPageName(active.name || copy.page, copy)); },
    requestRemoval: () => { if (active) setRemoval(controller.requestRemoval(active.key)); },
    closeRemoval: () => setRemoval(null),
    confirmRemoval: () => { if (removal && controller.confirmRemoval(removal)) setRemoval(null); },
    removalDescription: removal ? copy.deleteHelp.replace("{page}", removal.pageName).replace("{count}", number.format(removal.contentCount)) : "",
  };
}
