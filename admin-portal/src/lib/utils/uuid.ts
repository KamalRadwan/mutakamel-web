// The implementation lives in `@mutakamel/identifiers`, shared with the tenant
// portal. This copy had drifted: it carried the generator alone, without the
// `isUUIDv7` guard, so nothing here could check a key before sending it.
export { generateUUIDv7, isUUIDv7, uuidCrypto } from "@mutakamel/identifiers";
