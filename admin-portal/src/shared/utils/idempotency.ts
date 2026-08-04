/**
 * Generates a valid UUIDv7 string.
 * UUIDv7 embeds a 48-bit Unix timestamp in milliseconds,
 * making it time-ordered and suitable for idempotency keys.
 */
export function generateUUIDv7(): string {
  const now = Date.now();

  // 48 bits of timestamp
  const timeHex = now.toString(16).padStart(12, "0");

  // Random bytes for the rest
  const randomBytes = new Uint8Array(10);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Version 7 (0b0111 = 7)
  const verNibble = 0x7;
  const rand12 = ((randomBytes[0] & 0x0f) << 8) | randomBytes[1];
  const verAndRand = ((verNibble << 12) | rand12).toString(16).padStart(4, "0");

  // Variant 1 (0b10xx)
  const varByte = (randomBytes[2] & 0x3f) | 0x80;
  const varHex = varByte.toString(16).padStart(2, "0");
  const randHex = Array.from(randomBytes.slice(3))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-${verAndRand}-${varHex}${randHex.slice(0, 2)}-${randHex.slice(2)}`;
}
