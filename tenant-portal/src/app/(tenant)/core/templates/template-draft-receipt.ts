import type { TenantApiClientError } from "@/lib/api/axiosClient";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { record } from "../contracts/core-page";
import { templatePath } from "./templates-contract";

interface DraftHttpReceipt {
  status: number;
  headers: Headers;
  body: unknown;
  provenance?: "http" | "client" | "unknown";
  request?: TenantApiClientError["request"];
}

type DraftReceipt = { kind: "loaded" | "saved"; draft: Record<string, unknown> } | { kind: "stale" | "schema-changed" | "archived" | "unconfirmed" };
type DraftOperation = { method: "GET" } | { method: "PATCH"; ifMatch?: string };
const unconfirmed: DraftReceipt = { kind: "unconfirmed" };
const staleCode = "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION";
const staleProblemType = "https://errors.mutakamel.ai/core/template/concurrency/stale_revision";
const schemaChangedCode = "CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED";
const schemaChangedProblemType = "https://errors.mutakamel.ai/core/template/concurrency/schema_changed";
const archivedCode = "CORE.TEMPLATE.DEFINITION.ARCHIVED";
const archivedProblemType = "https://errors.mutakamel.ai/core/template/definition/archived";
const errorFields = ["errorCode", "code", "errorCategory", "errors", "details", "type", "title", "detail"];
const draftFields = ["draftId", "editorDocument", "revision", "etag"];

export function numericTemplateDraftPrecondition(ifMatch: string): string {
  return ifMatch.replace(/^"draft-schema:[0-9a-f]{64}:([1-9][0-9]*)"$/u, '"$1"');
}

/** Core success/error DTOs and Gateway Problem Details are distinct receipt shapes. */
export function readTemplateDraftReceipt(receipt: DraftHttpReceipt, templateId: string, operation: DraftOperation): DraftReceipt {
  const path = `${templatePath(templateId)}/draft`;
  const upstream = `/api/v1/templates/${encodeURIComponent(templateId)}/draft`;
  const request = receipt.request;
  if (receipt.provenance !== "http" || request?.method !== operation.method || request.endpoint !== path ||
    request.redirected !== false || typeof window === "undefined" || request.origin !== window.location.origin) return unconfirmed;
  // URL parsing can erase an empty query, fragment, or normalized path segment.
  if (request.finalUrl && request.finalUrl !== `${request.origin}${path}`) return unconfirmed;
  const body = record(receipt.body);
  if (!body) return unconfirmed;
  const has = (value: Record<string, unknown>, key: string) => Object.hasOwn(value, key);
  const coherentTarget = (value: Record<string, unknown>) =>
    (!has(value, "templateId") || value.templateId === templateId) &&
    (!has(value, "instance") || value.instance === path) &&
    (!has(value, "path") || value.path === path || value.path === upstream);
  const coherentRouteAndStatus = (value: Record<string, unknown>) =>
    coherentTarget(value) &&
    (!has(value, "statusCode") || value.statusCode === receipt.status) &&
    (!has(value, "status") || value.status === receipt.status);
  const coherentSuccess = (value: Record<string, unknown>) => coherentRouteAndStatus(value) &&
    (!has(value, "success") || value.success === true) && !errorFields.some(key => has(value, key));
  if (!coherentRouteAndStatus(body)) return unconfirmed;

  // Read the raw wire before either normalization or Core envelope unwrapping.
  if (operation.method === "PATCH" && (receipt.status === 409 || receipt.status === 412)) {
    // Error bodies can omit the draft identity. Require a corroborating route.
    if (!request.finalUrl && !has(body, "path") && !has(body, "instance")) return unconfirmed;
    // Core stores only successful draft commands for replay.
    if (isIdempotentReplay(receipt.headers) || (has(body, "success") && body.success !== false) ||
      (has(body, "errorCategory") && body.errorCategory !== "CONFLICT") ||
      has(body, "draft") || has(body, "migrationRecovery") || draftFields.some(key => has(body, key)) ||
      (has(body, "data") && body.data !== null)) return unconfirmed;
    const matchesError = (code: string, type: string) => (body.errorCode === code || body.code === code) &&
      (!has(body, "errorCode") || body.errorCode === code) && (!has(body, "code") || body.code === code) &&
      (!has(body, "type") || body.type === type);
    if (matchesError(staleCode, staleProblemType)) return { kind: "stale" };
    if (receipt.status === 409 && matchesError(schemaChangedCode, schemaChangedProblemType)) return { kind: "schema-changed" };
    if (receipt.status === 409 && matchesError(archivedCode, archivedProblemType)) return { kind: "archived" };
    return unconfirmed;
  }
  const reading = operation.method === "GET";
  if (receipt.status !== 200 || !coherentSuccess(body) || (reading && isIdempotentReplay(receipt.headers))) return unconfirmed;
  const wrapped = has(body, "data");
  if (wrapped && (has(body, "draft") || has(body, "migrationRecovery"))) return unconfirmed;
  if (reading && wrapped && draftFields.some(key => has(body, key))) return unconfirmed;
  const payload = wrapped ? record(body.data) : body;
  if (!payload || (wrapped && (has(payload, "data") || !coherentSuccess(payload)))) return unconfirmed;
  if (reading && (has(payload, "draft") || has(payload, "migrationRecovery"))) return unconfirmed;
  const draft = reading ? payload : record(payload.draft);
  const revision = draft?.revision;
  if (!draft || draft.templateId !== templateId || !coherentTarget(draft) ||
    typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 ||
    draft.etag !== `"${revision}"`) return unconfirmed;
  // Core saves once at the submitted revision, including when it replays that save.
  if (operation.method === "PATCH" && operation.ifMatch !== undefined) {
    // The Sales Quotation save caller supplies the original request precondition.
    if (revision < 2 || numericTemplateDraftPrecondition(operation.ifMatch) !== `"${revision - 1}"`) return unconfirmed;
  }
  const headerEtag = receipt.headers.get("etag");
  if (headerEtag !== null && headerEtag !== draft.etag) return unconfirmed;
  return { kind: reading ? "loaded" : "saved", draft };
}
