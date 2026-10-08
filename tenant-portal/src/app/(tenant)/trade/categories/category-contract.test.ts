import { describe, expect, it } from "vitest";
import { categoryAssignment, parseCategoryDetail, parseCategoryReceipt, parseCategoryTreePage, parseItemCategorySummary } from "./category-contract";

const id = "019f0000-0000-7000-8000-000000000001";
const other = "019f0000-0000-7000-8000-000000000002";
const now = "2026-09-27T10:00:00.000Z";
const segment = { id, code: "ROOT", name: "Root", siblingPosition: 1, siblingTotal: 1 };
const node = { id, code: "ROOT", name: "Root", displayName: "Root", parentId: null,
  status: "ACTIVE", effectiveActive: true, inactiveAncestorId: null, sortOrder: 1024,
  depth: 1, version: 1, path: [segment], hasChildren: false, childCount: 0 };
const page = { items: [node], total: 1, page: 1, limit: 50, treeVersion: 4, asOf: now, parentId: null };

describe("Category read boundary", () => {
  it("derives pagination without confusing the opaque tree token with a row version", () => {
    const result = parseCategoryTreePage(page);
    expect(result.treeVersion).toBe(4);
    expect(result.items[0].version).toBe(1);
    expect(result.hasNext).toBe(false);
  });
  it.each([
    { ...page, parentId: other },
    { ...page, items: [{ ...node, path: [] }] },
    { ...page, items: [{ ...node, path: [segment, segment], depth: 2 }] },
    { ...page, items: [{ ...node, hasChildren: true }] },
    { ...page, items: [{ ...node, id: "00000000-0000-4000-8000-000000000001" }] },
    { ...page, page: 201 },
  ])("rejects a malformed tree instead of presenting it as complete", (value) => {
    expect(() => parseCategoryTreePage(value)).toThrow();
  });
  it("requires deletion blockers to agree with eligibility", () => {
    const detail = { ...node, localizedNames: { en: "Root" }, treeVersion: 4, subtreeHeight: 1,
      createdAt: now, updatedAt: now, usage: { directItemCount: 0, subtreeItemCount: 0, descendantCount: 0,
        hasRetainedItemReferences: false, canDelete: true, deleteBlockers: ["ACTIVE"], asOf: now } };
    expect(() => parseCategoryDetail(detail)).toThrow();
  });
  it("does not treat a command receipt as fresh detail", () => {
    const receipt = { id, version: 2, treeVersion: 5, changed: true, name: "Untrusted" };
    expect(parseCategoryReceipt(receipt)).toEqual({ id, version: 2, treeVersion: 5, changed: true });
    expect(() => parseCategoryDetail(receipt)).toThrow();
  });
  it("allows an inactive assigned summary without treating it as a selectable option", () => {
    expect(parseItemCategorySummary({ id, code: "ROOT", name: "Root", path: [segment], effectiveActive: false, treeVersion: 5 })?.effectiveActive).toBe(false);
  });
});

describe("Category intent", () => {
  it("blocks unresolved creation and serializes an explicit no-category choice", () => {
    expect(() => categoryAssignment({ kind: "unresolved" })).toThrow();
    expect(categoryAssignment({ kind: "none" })).toEqual({ categoryId: null });
    expect(categoryAssignment({ kind: "selected", id })).toEqual({ categoryId: id });
  });
  it("omits unchanged edits even when option loading failed", () => {
    expect(categoryAssignment({ kind: "unresolved" }, id)).toEqual({});
    expect(categoryAssignment({ kind: "unresolved" }, null)).toEqual({});
    expect(categoryAssignment({ kind: "selected", id }, id)).toEqual({});
    expect(categoryAssignment({ kind: "none" }, null)).toEqual({});
    expect(categoryAssignment({ kind: "none" }, id)).toEqual({ categoryId: null });
    expect(categoryAssignment({ kind: "selected", id: other }, id)).toEqual({ categoryId: other });
  });
});
