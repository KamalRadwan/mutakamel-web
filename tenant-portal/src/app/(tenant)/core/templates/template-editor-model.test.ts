import { describe, expect, it } from "vitest";
import { appendEditorNode, moveEditorNode, orderedEditorNodes, parseEditorDocument, removeEditorNode, updateEditorNode, type EditorDocument, type EditorNode } from "./template-editor-model";

function node(id: string, parentId: string | null = null, childIds: string[] = []): EditorNode { return { id, type: "text", parentId, childIds, locked: false, hidden: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { text: id } }; }
function document(): EditorDocument { return { schemaVersion: 1, direction: "RTL", theme: { custom: "preserved" }, rootNodeIds: ["parent", "other"], nodes: { parent: node("parent", null, ["child"]), child: node("child", "parent"), other: node("other") }, metadata: { starterKey: "server-starter" } }; }

describe("schema-v1 visual draft operations", () => {
  it("preserves unsupported properties and immutable node identity when changing text", () => {
    const original = document(); const edited = updateEditorNode(original, "child", { id: "spoof", props: { text: "Quotation" } });
    expect(edited.nodes.child.id).toBe("child"); expect(edited.nodes.child.parentId).toBe("parent"); expect(edited.nodes.child.props.text).toBe("Quotation");
    expect(edited.metadata).toEqual(original.metadata); expect(edited.theme).toEqual(original.theme); expect(original.nodes.child.props.text).toBe("child");
  });
  it("moves siblings and keeps flow order consistent without changing parentage", () => {
    const moved = moveEditorNode(document(), "other", -1);
    expect(moved.rootNodeIds).toEqual(["other", "parent"]); expect(moved.nodes.other.layout.order).toBe(0); expect(moved.nodes.parent.layout.order).toBe(1); expect(moved.nodes.child.parentId).toBe("parent");
  });
  it("deletes a whole subtree without leaving a parent or root reference", () => {
    const removed = removeEditorNode(document(), "parent"); expect(removed.rootNodeIds).toEqual(["other"]); expect(Object.keys(removed.nodes)).toEqual(["other"]);
    const childRemoved = removeEditorNode(document(), "child"); expect(childRemoved.nodes.parent.childIds).toEqual([]);
  });
  it("protects locked nodes, locked parents and locked descendants", () => {
    const original = document(); original.nodes.child.locked = true;
    expect(removeEditorNode(original, "parent")).toBe(original); expect(updateEditorNode(original, "child", { hidden: true })).toBe(original);
    original.nodes.parent.locked = true; expect(moveEditorNode(original, "child", 1)).toBe(original);
  });
  it("creates actual schema nodes and traverses the document in graph order", () => {
    const added = appendEditorNode(document(), "dataField", "quotation.documentNumber"); const id = added.rootNodeIds.at(-1)!;
    expect(added.nodes[id].binding).toEqual({ path: "quotation.documentNumber", nullBehavior: "EMPTY" }); expect(added.nodes[id].layout).toEqual({ kind: "FLOW", order: 2 });
    expect(orderedEditorNodes(added).map((value) => value.id)).toEqual(["parent", "child", "other", id]); expect(parseEditorDocument(added)).toEqual(added);
  });
  it("refuses a dangling child or a different schema version", () => {
    const invalid = document(); invalid.nodes.parent.childIds.push("missing"); expect(() => parseEditorDocument(invalid)).toThrow(); expect(() => parseEditorDocument({ ...document(), schemaVersion: 2 })).toThrow();
  });
});
