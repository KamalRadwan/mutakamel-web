import type { EditorDocument, EditorNode } from "../../template-editor-model";

/** Conservative UI predicates for T01's existing absolute-frame controller, never a geometry engine. */
export function inspectorArrangementAffordances(document: EditorDocument | null, ids: readonly string[]) {
  const unavailable = { eligible: false, forward: false, backward: false, group: false, ungroup: false };
  if (!document || !ids.length || ids.some(id => !document.nodes[id])) return unavailable;
  const selected = new Set(ids), roots: EditorNode[] = [];
  for (const id of ids) {
    const node = document.nodes[id], seen = new Set<string>();
    let parentId: string | null = node.parentId;
    let nested = false;
    if (!parentId) return unavailable;
    while (parentId) {
      const parent: EditorNode | undefined = document.nodes[parentId];
      if (!parent || parent.locked || parent.hidden || seen.has(parentId)) return unavailable;
      seen.add(parentId); if (selected.has(parentId)) nested = true; parentId = parent.parentId;
    }
    if (!nested) roots.push(node);
  }
  for (const root of roots) {
    const frame = root.layout;
    if (frame.kind !== "ABSOLUTE" || frame.unit !== "MM" || ![frame.x, frame.y, frame.width, frame.height, frame.rotationDeg, frame.zIndex].every(value => typeof value === "number" && Number.isFinite(value))) return unavailable;
    const pending = [root.id], seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!, node = document.nodes[id];
      if (!node || node.locked || node.hidden || seen.has(id)) return unavailable;
      seen.add(id); pending.push(...node.childIds);
    }
  }
  if (!roots.length) return unavailable;
  return { eligible: true, forward: roots.every(node => Number(node.layout.zIndex) < 1000), backward: roots.every(node => Number(node.layout.zIndex) > 0),
    group: roots.length >= 2 && roots.every(node => node.parentId === roots[0].parentId),
    ungroup: roots.length === 1 && roots[0].type === "group" && roots[0].childIds.length > 0 };
}
