// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCategoryDetail } from "../category-contract";
import { useCategoryEditor } from "./useCategoryEditor";

afterEach(cleanup);
const id = "019f0000-0000-7000-8000-000000000001";
const now = "2026-09-27T10:00:00.000Z";
const source = parseCategoryDetail({ id, code: "ROOT", name: "Root", displayName: "Root", parentId: null,
  status: "INACTIVE", effectiveActive: false, inactiveAncestorId: null, sortOrder: 1024, depth: 1,
  version: 2, treeVersion: 4, path: [{ id, code: "ROOT", name: "Root", siblingPosition: 1, siblingTotal: 1 }],
  hasChildren: false, childCount: 0, subtreeHeight: 1, localizedNames: { en: "Root", fr: "Racine" },
  createdAt: now, updatedAt: now, usage: { directItemCount: 0, subtreeItemCount: 0, descendantCount: 0,
    hasRetainedItemReferences: false, canDelete: true, deleteBlockers: [], asOf: now } });

describe("Category editor commands", () => {
  it("rejects control characters and future status values without guessing a transition", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const edit = renderHook(() => useCategoryEditor({ action: "update", source, treeVersion: 4 }, submit));
    act(() => edit.result.current.setDisplayName("Name\u202e"));
    await act(async () => { await edit.result.current.save(); });
    expect(edit.result.current.issues.displayName).toBe(true);
    const status = renderHook(() => useCategoryEditor({ action: "status", source: { ...source, status: "FUTURE" }, treeVersion: 4 }, submit));
    act(() => status.result.current.setReason("Review"));
    await act(async () => { await status.result.current.save(); });
    expect(submit).not.toHaveBeenCalled();
  });

  it("measures normalized Unicode names rather than UTF-16 length", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategoryEditor({ action: "update", source, treeVersion: 4 }, submit));
    act(() => result.current.setDisplayName("e\u0301".repeat(160)));
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledTimes(1);
    act(() => result.current.setDisplayName("😀".repeat(160)));
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("retains every translation on metadata edits and never submits code or tree version", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategoryEditor({ action: "update", source, treeVersion: 4 }, submit));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setDisplayName("New name"));
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledWith({ action: "update", id, version: 2,
      body: { displayName: "New name", localizedNames: { en: "Root", fr: "Racine" } } });
  });
  it("blocks structural commands until the destination or append choice is explicit", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategoryEditor({ action: "reorder", source, treeVersion: 4 }, submit));
    await act(async () => { await result.current.save(); });
    expect(result.current.invalid).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.setTarget({ kind: "none" }));
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledWith({ action: "reorder", id, version: 2, body: { beforeId: null, expectedTreeVersion: 4 } });
  });
  it("keeps draft text when reviewed server tokens are refreshed", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ current }) => useCategoryEditor({ action: "update", source: current, treeVersion: current.treeVersion }, submit),
      { initialProps: { current: source } });
    act(() => result.current.setDisplayName("Preserved draft"));
    rerender({ current: { ...source, version: 3, treeVersion: 5, displayName: "Other actor" } });
    expect(result.current.displayName).toBe("Preserved draft");
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ version: 3, body: expect.objectContaining({ displayName: "Preserved draft" }) }));
  });
  it("requires an audit reason for deletion", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategoryEditor({ action: "delete", source, treeVersion: 4 }, submit));
    await act(async () => { await result.current.save(); });
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.setReason("Unused category"));
    await act(async () => { await result.current.save(); });
    expect(submit).toHaveBeenCalledWith({ action: "delete", id, version: 2, body: { reason: "Unused category", expectedTreeVersion: 4 } });
  });
});
