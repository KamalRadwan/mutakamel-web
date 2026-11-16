import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { safeSessionStorage } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";
import type { TemplateDraftDocument } from "../../template-design-api";
import { numericTemplateDraftPrecondition } from "../../template-draft-receipt";
import type { EditorDocument } from "../../template-editor-model";
import { record } from "../../../contracts/core-page";

interface SavedCommand {
  draftId: string;
  revision: number;
  mutationId: string;
  digest: string;
  ifMatch?: string;
}

export type RetainedSalesDraftSave = SavedCommand | "invalid";

export function salesDraftSaveStorageKey(ownerKey: string): string {
  return `sales-quotation:draft-save:${hash(ownerKey)}`;
}

function hash(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

function digest(editorDocument: EditorDocument, clientMutationId: string): string {
  return hash(canonicalJson({ editorDocument, clientMutationId }));
}

export function readSalesDraftSave(key: string): RetainedSalesDraftSave | null {
  const raw = safeSessionStorage.getItem(key);
  if (raw === null) return null;
  if (raw.length > 384) return "invalid";
  try {
    const value = record(JSON.parse(raw));
    if (!value) return "invalid";
    const guarded = Object.hasOwn(value, "ifMatch");
    if (Object.keys(value).length === (guarded ? 5 : 4) && isUUIDv7(value.draftId) && isUUIDv7(value.mutationId) &&
      typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision > 0 &&
      value.revision < Number.MAX_SAFE_INTEGER && typeof value.digest === "string" && /^[a-f0-9]{64}$/u.test(value.digest)) {
      const { draftId, revision, mutationId, digest, ifMatch } = value;
      if (!guarded) return { draftId, revision, mutationId, digest };
      const etag = `"${revision}"`;
      if (typeof ifMatch === "string" && ifMatch !== etag && numericTemplateDraftPrecondition(ifMatch) === etag) {
        return { draftId, revision, mutationId, digest, ifMatch };
      }
    }
  } catch { return "invalid"; }
  return "invalid";
}

export function retainSalesDraftSave(key: string, base: TemplateDraftDocument, document: EditorDocument, mutationId: string,
  ifMatch = base.etag): SavedCommand | null {
  if (readSalesDraftSave(key) || numericTemplateDraftPrecondition(ifMatch) !== base.etag) return null;
  const command = { draftId: base.draftId, revision: base.revision, mutationId, digest: digest(document, mutationId),
    ...(ifMatch !== base.etag && { ifMatch }) };
  safeSessionStorage.setItem(key, JSON.stringify(command));
  return command;
}

export function isCurrentSalesDraftSave(key: string, command: SavedCommand): boolean {
  const stored = readSalesDraftSave(key);
  return stored !== null && stored !== "invalid" && stored.mutationId === command.mutationId &&
    stored.draftId === command.draftId && stored.revision === command.revision && stored.digest === command.digest &&
    stored.ifMatch === command.ifMatch;
}

export function clearSalesDraftSave(key: string, command: SavedCommand): void {
  if (isCurrentSalesDraftSave(key, command)) safeSessionStorage.removeItem(key);
}

export function discardSalesDraftSave(key: string, command: RetainedSalesDraftSave): boolean {
  if (command === "invalid") {
    if (readSalesDraftSave(key) === "invalid") safeSessionStorage.removeItem(key);
  } else {
    clearSalesDraftSave(key, command);
  }
  return readSalesDraftSave(key) === null;
}

export function matchesSalesDraftSave(command: RetainedSalesDraftSave, draft: TemplateDraftDocument): command is SavedCommand {
  return command !== "invalid" && command.draftId === draft.draftId && draft.revision === command.revision + 1 &&
    draft.etag === `"${draft.revision}"` && draft.editorDocument.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" &&
    digest(draft.editorDocument, command.mutationId) === command.digest;
}
