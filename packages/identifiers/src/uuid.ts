const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isUUIDv7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

export function generateUUIDv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const milliseconds = Date.now();
  const high = Math.floor(milliseconds / 0x1_0000_0000);
  const low = milliseconds % 0x1_0000_0000;

  bytes[0] = (high >> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >> 24) & 0xff;
  bytes[3] = (low >> 16) & 0xff;
  bytes[4] = (low >> 8) & 0xff;
  bytes[5] = low & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let value = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value += bytes[index].toString(16).padStart(2, "0");
    if (index === 3 || index === 5 || index === 7 || index === 9) {
      value += "-";
    }
  }
  return value;
}

/**
 * `crypto.randomUUID()` is defined **only in a secure context** — HTTPS, or a
 * `localhost` origin. Tenant development is neither: it runs over plain HTTP on
 * a real tenant hostname (`http://mersany.mutakamel.ai:5002`) because the
 * Gateway resolves the tenant from `Host`, and `localhost` resolves to no
 * tenant at all. In that context the browser simply does not define
 * `randomUUID`, and `@mutakamel/realtime-app-client` throws
 * `crypto.randomUUID is not a function` from its handshake before the provider
 * can mount.
 *
 * `crypto.getRandomValues` has no such gate, so `generateUUIDv7` costs nothing
 * in randomness quality — it is the same CSPRNG.
 *
 * It is used **unconditionally**, never `crypto.randomUUID()`, even where the
 * native call exists. This workspace issues UUIDv7 only (AGENTS.md), and
 * `randomUUID()` emits a v4 — so preferring it in a secure context would make
 * the identifier version depend on how the page happened to be served.
 *
 * Shaped as an object because that is what `createBrowserClientIdentifiers`
 * takes (`BrowserIdentifierCrypto`), and passing `window.crypto` straight in is
 * the bug this exists to prevent.
 */
export const uuidCrypto: { randomUUID(): string } = {
  randomUUID: generateUUIDv7,
};
