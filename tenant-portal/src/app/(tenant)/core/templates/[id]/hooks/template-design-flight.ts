import { TenantApiClientError } from "@/lib/api/axiosClient";
import { readTemplateDraftReceipt } from "../../template-draft-receipt";
import type { EditorDocument } from "../../template-editor-model";
import type { TemplateDraftDocument } from "../../template-design-api";

export interface PendingDraft { document: EditorDocument; etag: string; mutationId: string }
export interface DraftOwner { key: string; epoch: number }
export interface SaveFlight {
  owner: DraftOwner;
  intent: PendingDraft;
  base: TemplateDraftDocument;
  readonly authorizationVersion: number;
  transportFenced: boolean;
  request: Readonly<{ documentJson: string; etag: string; mutationId: string }>;
}

export type BoundDraftIntent = Pick<SaveFlight, "owner" | "intent" | "base" | "request">;

export function classifyDraftConflict(cause: unknown, templateId: string) {
  if (!(cause instanceof TenantApiClientError) || (cause.response.status !== 409 && cause.response.status !== 412)) return null;
  const { kind } = readTemplateDraftReceipt({
    ...cause.response, body: cause.rawData, provenance: cause.provenance, request: cause.request,
  }, templateId, { method: "PATCH" });
  return kind;
}

export function isLocalWriteFence(cause: unknown, code: string | undefined): boolean {
  return cause instanceof TenantApiClientError && cause.provenance === "client" &&
    (code === "AUTH_SESSION_CHANGED" || code === "AUTH_SESSION_ENDED" || code === "RESPONSE_TARGET_UNCONFIRMED");
}

