import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUUIDv7, isUUIDv7, uuidCrypto } from "./uuid";

// The exact pattern `@mutakamel/realtime-app-client` validates identifiers
// against in `createClientIdentifier`. Copied deliberately rather than
// imported: it is not exported, and the point of pinning it here is to catch
// the day our fallback stops satisfying the consumer that forced it to exist.
const CLIENT_IDENTIFIER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe("generateUUIDv7", () => {
  it("emits a well-formed v7 that the realtime handshake accepts", () => {
    const value = generateUUIDv7();
    expect(isUUIDv7(value)).toBe(true);
    expect(value).toMatch(CLIENT_IDENTIFIER_PATTERN);
  });
});

describe("uuidCrypto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // AGENTS.md: this workspace issues UUIDv7 only. `crypto.randomUUID()` emits a
  // v4, so it must not be preferred even where the browser defines it —
  // otherwise the identifier version would depend on how the page was served.
  it("ignores the native randomUUID and still emits a v7", () => {
    const native = vi.fn(() => "6f9619ff-8b86-4d01-b42d-00cf42d68b1a");
    // `getRandomValues` lives on the prototype, so spreading `globalThis.crypto`
    // silently drops it. Bind it across explicitly.
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      randomUUID: native,
    });

    const value = uuidCrypto.randomUUID();
    expect(native).not.toHaveBeenCalled();
    expect(isUUIDv7(value)).toBe(true);
  });

  // The regression this module exists for. Over plain HTTP on a non-localhost
  // host the browser leaves `randomUUID` undefined while keeping
  // `getRandomValues`, and passing `window.crypto` straight into
  // `createBrowserClientIdentifiers` threw before the provider could mount.
  it("falls back to a valid identifier when randomUUID is absent", () => {
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: getRandomValues.bind(globalThis.crypto),
    });

    expect(
      (globalThis.crypto as Partial<Crypto>).randomUUID,
    ).toBeUndefined();

    const value = uuidCrypto.randomUUID();
    expect(value).toMatch(CLIENT_IDENTIFIER_PATTERN);
  });

  it("does not repeat itself", () => {
    const values = new Set(
      Array.from({ length: 200 }, () => uuidCrypto.randomUUID()),
    );
    expect(values.size).toBe(200);
  });
});
