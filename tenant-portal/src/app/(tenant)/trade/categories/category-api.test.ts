import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureCategorySubmission, readCategories, readCategoryOptions, submitCategory, type CategoryCommand } from "./category-api";

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../trade-api", async (original) => ({
  ...await original<typeof import("../trade-api")>(), tradeGet: get, tradePost: post, tradePatch: patch,
}));
const id = "019f0000-0000-7000-8000-000000000001";
const now = "2026-09-27T10:00:00.000Z";
const result = (data: unknown) => ({ data, headers: new Headers({ "idempotency-replayed": "false" }), status: 200 });
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(result({ items: [], total: 0, page: 1, limit: 50, treeVersion: 1, asOf: now }));
  post.mockImplementation(async (_path, body) => result(body.search ?
    { items: [], total: 0, page: 1, limit: 50, treeVersion: 1, asOf: now } :
    { id, version: 2, treeVersion: 4, changed: true }));
  patch.mockResolvedValue(result({ id, version: 2, treeVersion: 4, changed: true }));
});

describe("Category Gateway requests", () => {
  it("uses the read-only search policy without a generated idempotency key or company headers", async () => {
    await readCategories({ locale: "ar", search: "أجهزة" });
    expect(post).toHaveBeenCalledWith("/api/tenant/trade/v1/categories/search",
      { locale: "ar", search: "أجهزة", page: 1, limit: 50 }, expect.objectContaining({ headers: {}, skipAutoIdempotency: true }));
  });
  it("passes operating scope only to the authorized options projection", async () => {
    await readCategoryOptions({ locale: "ar" }, { "x-mutakamel-company-id": id });
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/catalog/categories?"),
      expect.objectContaining({ headers: { "x-mutakamel-company-id": id }, maxResponseBytes: 1_048_576 }));
    await readCategories({ locale: "en" });
    expect(get.mock.calls[1][1].headers).toEqual({});
  });
  it.each<CategoryCommand>([
    { action: "create", body: { code: "ROOT", displayName: "Root", localizedNames: { en: "Root" }, parentId: null, expectedTreeVersion: 3 } },
    { action: "update", id, version: 1, body: { displayName: "New name" } },
    { action: "move", id, version: 1, body: { parentId: null, expectedTreeVersion: 3 } },
    { action: "reorder", id, version: 1, body: { beforeId: null, expectedTreeVersion: 3 } },
    { action: "status", id, version: 1, body: { status: "INACTIVE", reason: "Unused", expectedTreeVersion: 3 } },
    { action: "delete", id, version: 1, body: { reason: "Unused", expectedTreeVersion: 3 } },
  ])("sends $action with explicit no-replay policy and captured preconditions", async (command) => {
    if (command.action === "delete") post.mockResolvedValueOnce(result({ id, version: 2, treeVersion: 4, deleted: true, deletedAt: now }));
    const submission = captureCategorySubmission(command);
    await submitCategory(submission);
    const call = (command.action === "update" ? patch : post).mock.calls[0];
    expect(call[1]).toEqual(command.body);
    expect(call[2]).toEqual({ headers: { "x-idempotency-key": submission.key,
      ...(command.action === "create" ? {} : { "if-match": '"1"' }) }, nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 16_384 });
    const suffix = command.action === "create" ? "" : command.action === "update" ? `/${id}` : `/${id}/${command.action}`;
    expect(call[0]).toBe(`/api/tenant/trade/v1/categories${suffix}`);
  });
  it("fails closed when a successful response belongs to another command", async () => {
    patch.mockResolvedValueOnce(result({ id: "019f0000-0000-7000-8000-000000000002", version: 2, treeVersion: 4, changed: true }));
    await expect(submitCategory(captureCategorySubmission({ action: "update", id, version: 1, body: { displayName: "Name" } }))).rejects.toThrow("Unexpected Category receipt.");
  });
});
