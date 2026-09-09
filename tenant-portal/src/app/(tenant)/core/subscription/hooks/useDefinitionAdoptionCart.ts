"use client";

import { useState } from "react";
import { generateUUIDv7 } from "@/lib/uuid";
import { parseDefinitionAdoptionRequest, parseDefinitionAdoptionSources, type DefinitionAdoptionRequest, type DefinitionAdoptionSource } from "../definition-adoption-command";
import type { DefinitionAdoptionSelection, DefinitionAdoptionTarget } from "../definition-adoption-discovery";
import type { useCommercialChange } from "./useCommercialChange";
import type { useDefinitionAdoptionDiscovery } from "./useDefinitionAdoptionDiscovery";

interface Row { selection: DefinitionAdoptionSelection; target: DefinitionAdoptionTarget; selectionKey: string }
interface Cart { key: string; rows: Row[]; reason: string }
interface Review { key: string; request: DefinitionAdoptionRequest; sources: DefinitionAdoptionSource[] }

export function useDefinitionAdoptionCart(discovery: ReturnType<typeof useDefinitionAdoptionDiscovery>, change: ReturnType<typeof useCommercialChange>) {
  const key = discovery.snapshotKey;
  const [cart, setCart] = useState<Cart>({ key, rows: [], reason: "" });
  const [review, setReview] = useState<Review | null>(null);
  const [invalid, setInvalid] = useState(false);
  const enabled = change.canStart && !discovery.busy && !discovery.denied && !discovery.state?.error;
  if (cart.key !== key) { setCart({ key, rows: [], reason: "" }); setReview(null); setInvalid(false); }
  if (review && (review.key !== key || !enabled)) setReview(null);
  const current = cart.key === key ? cart : { key, rows: [], reason: "" };
  const add = (targetId: string) => {
    const selection = discovery.state?.selected, target = discovery.state?.targets?.items.find((row) => row.targetDefinitionVersionId === targetId);
    if (!enabled || !selection || !target || current.rows.length >= 100 || current.rows.some((row) => row.selection.addonSelectionId === selection.addonSelectionId)) return;
    setCart({ ...current, rows: [...current.rows, { selection, target, selectionKey: generateUUIDv7() }] }); setReview(null);
  };
  const remove = (id: string) => { if (enabled) { setCart({ ...current, rows: current.rows.filter((row) => row.selectionKey !== id) }); setReview(null); } };
  const reason = (value: string) => { if (enabled) { setCart({ ...current, reason: value }); setReview(null); } };
  const prepareReview = () => {
    if (!enabled || discovery.revision === null) return;
    try {
      const request = parseDefinitionAdoptionRequest({ expectedSubscriptionRevision: discovery.revision,
        changes: current.rows.map((row) => ({ selectionKey: row.selectionKey, sourceKind: "ADDON", operation: "ADOPT_DEFINITION",
          addonSelectionId: row.selection.addonSelectionId, targetDefinitionVersionId: row.target.targetDefinitionVersionId })),
        ...(current.reason.trim() ? { reason: current.reason.trim() } : {}),
      });
      const sources = parseDefinitionAdoptionSources(request, current.rows.map((row) => ({ selectionKey: row.selectionKey,
        addonSelectionId: row.selection.addonSelectionId, fromDefinitionVersionId: row.selection.currentDefinition.definitionVersionId })));
      setReview({ key, request, sources }); setInvalid(false);
    } catch { setInvalid(true); }
  };
  const confirm = async () => {
    if (!enabled || !review || review.key !== key || review.request.expectedSubscriptionRevision !== discovery.revision) return;
    await change.start(review.request, review.sources); setReview(null);
  };
  return { cart: current, review: review?.key === key ? review : null, invalid, enabled, add, remove, reason, prepareReview, confirm, close: () => setReview(null) };
}
