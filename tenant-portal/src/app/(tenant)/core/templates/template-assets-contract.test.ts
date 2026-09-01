import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "./template-assets-contract";

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
