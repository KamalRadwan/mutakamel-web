import { SALES_DRAFT_TYPING_PREFIX, safeSessionStorage } from "@/lib/safeStorage";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { record } from "../../../contracts/core-page";
import { isUUIDv7 } from "@/lib/uuid";
import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateDraftDocument } from "../../template-design-api";
import { TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "../../template-wire";
import { salesDraftSaveStorageKey } from "./sales-draft-save-storage";

const typingChangeEvent = "sales-quotation:draft-typing-change";
type TypingDraft = Pick<TemplateDraftDocument, "templateId" | "draftId" | "revision" | "etag">;
export type SalesDraftTyping = { digest: string; edits: [string, string][] };
type TypingRollover = {
  key: string;
  href: string;
  sessionId: string;
  authorizationVersion: number;
  profileVersion: number;
  eventId: string;
  draft: TypingDraft;
  descriptorChecksum: string;
  typing: SalesDraftTyping;
};
let rollover: { value: TypingRollover; stop: () => void } | null = null;

export function watchSalesDraftTypingRoute(href: string, retire: () => void): (() => void) | null {
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  if (!navigation || window.location.href !== href) return null;
  const onNavigate = (event: Event) => {
    const { destination, navigationType } = event as Event & {
      destination: { url: string };
      navigationType: string;
    };
    if (destination.url !== href || navigationType === "push" || navigationType === "traverse") retire();
  };
  navigation.addEventListener("navigate", onNavigate);
  window.addEventListener("pagehide", retire);
  window.addEventListener("popstate", retire);
  return () => {
    navigation.removeEventListener("navigate", onNavigate);
    window.removeEventListener("pagehide", retire);
    window.removeEventListener("popstate", retire);
  };
}

export function discardSalesDraftTypingRollover(unlessOwner?: string): void {
  const held = rollover;
  if (!held || (unlessOwner && held.value.key === salesDraftTypingStorageKey(salesDraftSaveStorageKey(unlessOwner)))) return;
  rollover = null;
  held.stop();
}

export function holdSalesDraftTypingRollover(value: TypingRollover): void {
  discardSalesDraftTypingRollover();
  const stopWatching = watchSalesDraftTypingRoute(value.href, () => discardSalesDraftTypingRollover());
  if (!stopWatching) return;
  const unsubscribe = subscribeToTenantAuthEvents(event => {
    if (event.kind === "session-ended" || event.sessionId !== value.sessionId || event.eventId !== value.eventId) {
      discardSalesDraftTypingRollover();
    }
  });
  rollover = { value, stop: () => {
    unsubscribe();
    stopWatching();
  } };
}

export function takeSalesDraftTypingRollover(): TypingRollover | null {
  const value = rollover?.value ?? null;
  discardSalesDraftTypingRollover();
  return value;
}

export function salesDraftEditorOwnerKey(template: TemplateDetail, authState: string, actorId: string | undefined,
  generation: string | null | undefined, canReadDraft: boolean): string {
  const { type, companyId, branchId } = template.scope;
  return JSON.stringify([template.id, template.dataSourceKey, template.documentType, template.outputChannel, template.layoutMode,
    template.locale, type, companyId, branchId, authState, actorId, generation, canReadDraft]);
}

export function salesDraftTypingStorageKey(saveKey: string): string {
  return SALES_DRAFT_TYPING_PREFIX + saveKey;
}

export function setSalesDraftTyping(key: string, value: string | null): void {
  if (safeSessionStorage.getItem(key) === value) return;
  if (value === null) safeSessionStorage.removeItem(key);
  else safeSessionStorage.setItem(key, value);
  window.dispatchEvent(new Event(typingChangeEvent));
}

export function subscribeSalesDraftTyping(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(SALES_DRAFT_TYPING_PREFIX)) onChange();
  };
  window.addEventListener(typingChangeEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(typingChangeEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function readSalesDraftTyping(key: string, draft: TypingDraft,
  authorizationVersion: number | undefined): SalesDraftTyping | null {
  if (authorizationVersion === undefined) return null;
  const raw = safeSessionStorage.getItem(key);
  if (!raw || raw.length > TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES) return null;
  try {
    const retained = record(JSON.parse(raw));
    if (!retained || retained.templateId !== draft.templateId || retained.draftId !== draft.draftId ||
      retained.revision !== draft.revision || retained.etag !== draft.etag || retained.authorizationVersion !== authorizationVersion ||
      typeof retained.digest !== "string" || !/^[a-f0-9]{64}$/u.test(retained.digest) ||
      !Array.isArray(retained.edits) || !retained.edits.length || retained.edits.length > TEMPLATE_LIMITS.maxNodes) return null;
    const edits = new Map<string, string>();
    for (const edit of retained.edits as unknown[]) {
      if (!Array.isArray(edit) || edit.length !== 2) return null;
      const [id, text] = edit as unknown[];
      if (!isUUIDv7(id) || typeof text !== "string" || text.length > TEMPLATE_LIMITS.maxTextCharsPerNode || edits.has(id)) return null;
      edits.set(id, text);
    }
    return { digest: retained.digest, edits: [...edits] };
  } catch { return null; }
}

export function hasSalesDraftTyping(template: TemplateDetail, authState: string, actorId: string, generation: string,
  authorizationVersion: number): boolean {
  const owner = salesDraftEditorOwnerKey(template, authState, actorId, generation, true);
  const key = salesDraftTypingStorageKey(salesDraftSaveStorageKey(owner));
  return readSalesDraftTyping(key, { templateId: template.id, ...template.currentDraft }, authorizationVersion) !== null;
}
