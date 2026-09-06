// The one place this workspace mints identifiers.
//
// It exists because there were two: `tenant-portal/src/lib/uuid.ts` and
// `admin-portal/src/lib/utils/uuid.ts` held the same bit-twiddling twice, and
// the admin copy had already drifted — it carried the generator alone, without
// the `isUUIDv7` guard or the `uuidCrypto` shim the realtime handshake needs.
// Two copies of a format that the Gateway REJECTS when it is wrong (400
// GW.IDEM.BAD_VALUE on any `x-idempotency-key` that is not a v7) is one copy
// too many.
export { generateUUIDv7, isUUIDv7, uuidCrypto } from "./uuid";
