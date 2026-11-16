import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { fetchUploadedTemplateAsset, sha256Hex, uploadTemplateAsset } from "./template-assets-contract";

const io = vi.hoisted(() => ({ read: vi.fn(), post: vi.fn() }));
vi.mock("../core-api", () => ({ coreGet: io.read, corePost: io.post }));

describe("template asset hashes on HTTP", () => {
  beforeEach(() => vi.stubGlobal("crypto", {}));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["empty", new Uint8Array()],
    ["ASCII", new TextEncoder().encode("abc")],
    ["UTF-8", new TextEncoder().encode("متكامل ✅\0\r\n")],
    ["binary across block boundaries", Uint8Array.from({ length: 1_025 }, (_, index) => index % 256)],
  ])("preserves the SHA-256 of %s bytes without SubtleCrypto", async (_label, bytes) => {
    const file = new File([bytes], "asset.png", { type: "image/png" });
    await expect(sha256Hex(file)).resolves.toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });

  it("matches the standard empty-message SHA-256 vector", async () => {
    await expect(sha256Hex(new File([], "empty.png"))).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("definition asset upload transport", () => {
  const assetId = "01902001-3000-7000-8000-000000000006";
  const definitionId = "01902001-3000-7000-8000-000000000007";
  const path = `/api/tenant/core/v1/templates/assets/${assetId}`;
  const origin = "http://mersany.mutakamel.ai:5002";
  const assertCurrent = vi.fn();

  it("keeps the multipart shape and caller write key", async () => {
    const file = new File(["png"], "asset.png", { type: "image/png" });
    const metadata = { definitionId, assetType: "IMAGE", deliveryClass: "PRIVATE_ONLY", fileName: file.name,
      declaredMimeType: "image/png", expectedRawSha256: "a".repeat(64) } as const;
    io.post.mockResolvedValueOnce({ status: 201, data: { asset: { ...metadata, assetId, originalFileName: file.name,
      mimeType: file.type, sizeBytes: file.size, status: "ACTIVE", revision: 1, etag: `"asset:${assetId}:1"`,
      createdAt: "2026-11-13T08:00:00Z" } } });
    await expect(uploadTemplateAsset(metadata, file, { mutationId: assetId, assertCurrent })).resolves.toMatchObject({ id: assetId });
    const [route, body, config] = io.post.mock.lastCall!;
    expect(route).toBe("/api/tenant/core/v1/templates/assets");
    expect([...body.keys()]).toEqual(["metadata", "file"]);
    expect(JSON.parse(body.get("metadata"))).toEqual(metadata);
    expect(config).toMatchObject({ headers: { "x-idempotency-key": assetId }, assertCurrent,
      nonReplayable: true, requireExactResponseTarget: true });
  });

  it("allows the original-key retry only after the exact Core not-found response", async () => {
    const missing = { status: 404, statusText: "Not Found", headers: new Headers(), data: { code: "CORE.TEMPLATE.NOT_FOUND" } };
    const request = { method: "GET", endpoint: path, origin, finalUrl: `${origin}${path}`, redirected: false };
    io.read.mockRejectedValueOnce(new TenantApiClientError("missing", missing, "http", request));
    await expect(fetchUploadedTemplateAsset(assetId, assertCurrent)).resolves.toBeNull();
    expect(io.read).toHaveBeenLastCalledWith(path, expect.objectContaining({ assertCurrent, requireExactResponseTarget: true }));
    for (const route of [{ ...request, redirected: true }, { ...request, finalUrl: origin + "/missing" }]) {
      const unverified = new TenantApiClientError("missing", missing, "http", route);
      io.read.mockRejectedValueOnce(unverified);
      await expect(fetchUploadedTemplateAsset(assetId, assertCurrent)).rejects.toBe(unverified);
    }
  });
});
