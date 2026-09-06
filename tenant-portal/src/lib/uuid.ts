// The implementation lives in `@mutakamel/identifiers`, shared with the admin
// portal — the same bytes were being twiddled in two places, and the copies had
// already drifted apart. This file stays as the portal's import surface so the
// ninety-odd call sites keep addressing it the way they address every other
// `@/lib` module, and so there is exactly one thing to change if the identifier
// contract ever moves.
export { generateUUIDv7, isUUIDv7, uuidCrypto } from "@mutakamel/identifiers";
