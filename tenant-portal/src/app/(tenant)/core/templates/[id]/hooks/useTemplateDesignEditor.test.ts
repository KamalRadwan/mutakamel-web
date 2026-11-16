// @vitest-environment jsdom
import { createHash, webcrypto } from "node:crypto";
import { createElement, type ReactNode } from "react";
import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import { axiosClient, clearLocalTenantAuthState, getStoredTenantSessionMeta, subscribePermissionDenials, synchronizeTenantTabSession, TenantApiClientError } from "@/lib/api/axiosClient";
import { SALES_DRAFT_TYPING_PREFIX } from "@/lib/safeStorage";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTemplateDesignEditor } from "./useTemplateDesignEditor";
import { discardSalesDraftTypingRollover, takeSalesDraftTypingRollover } from "./sales-draft-typing-storage";
import { TemplateDesignWorkspace } from "../design/TemplateDesignWorkspace";
import ownerFixture from "../../template-owner-admission-api.fixture.json";
import { readTemplateOwnerAdmission } from "../../template-owner-admission";
import * as salesQuotationOrigin from "../bindings/sales-quotation-origin-observation";
import type { DesignerNativeRuntime } from "../../designer-native-runtime";
import type { TemplateDetail } from "../../templates-contract";
import type { EditorDocument } from "../../template-editor-model";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), schema: vi.fn(), assets: vi.fn(), preview: vi.fn() }));
vi.mock("../../template-design-api", () => ({ fetchTemplateDraft: mocks.read, saveTemplateDraft: mocks.save, fetchTemplateDataSchema: mocks.schema }));
vi.mock("../../template-assets-contract", () => ({ fetchTemplateAssets: mocks.assets }));
vi.mock("../../template-lifecycle-api", () => ({ previewTemplateHtml: mocks.preview }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { common: { retry: "Retry" }, coreOperations: { templates: { definitionTitle: "Definition" } }, quotationPdf: { editorUnsupported: "Unsupported", editorUnavailable: "Unavailable", text: "Text", unknownHint: "Recover request", conflict: "Conflict", requestError: "Failed", draftSchemaChanged: "Schema changed", previewFailed: "Preview failed" } } }) }));
vi.mock("@/lib/api/errors", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/api/errors")>();
  return { ...actual, normalizeApiError: (error: unknown) =>
    error && typeof error === "object" && "status" in error && !(error instanceof Error) ? error : actual.normalizeApiError(error) };
});
const ID = "01890000-0000-7000-8000-000000000001";
const bodyId = "01890000-0000-7000-8000-000000000002";
const textId = "01890000-0000-7000-8000-000000000003";
const source = { documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT",
  dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "ar-EG" } as const;
const template = { ...source, id: ID, scope: { type: "TENANT" } } as TemplateDetail;
const document: EditorDocument = {
  ...source, schemaVersion: 1, direction: "RTL", theme: {}, rootNodeIds: [bodyId],
  nodes: {
    [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], locked: false, hidden: false,
      layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
    [textId]: { id: textId, type: "text", parentId: bodyId, childIds: [], locked: false, hidden: false,
      layout: { kind: "FLOW", order: 0 }, style: {}, props: { text: "Quotation" } },
  },
};
const draft = { draftId: ID, templateId: ID, revision: 3, etag: '"3"', editorDocument: document };
const salesOwnerSchema = ownerFixture.rows.find(row => row.adapterKey === source.dataSourceKey)!;
const salesOwnerRuntime: DesignerNativeRuntime = {
  pins: ownerFixture.producerObservations.find(row => row.adapterKey === source.dataSourceKey)!.pins,
  canonicalJson, isCurrent: () => true, createSource: () => null,
};
const salesSchemaEndpoint = `/api/tenant/core/v1/templates/data-sources/${source.dataSourceKey}/schema?scopeType=TENANT&schemaVersion=1`;
function salesSchemaReply(body: unknown, etag?: string) {
  const response = Response.json({ success: true, data: body }, { headers: etag ? { ETag: etag } : undefined });
  Object.defineProperty(response, "url", { value: window.location.origin + salesSchemaEndpoint });
  return response;
}
const hideText = (editor: Pick<ReturnType<typeof useTemplateDesignEditor>, "setNodeFlags">) =>
  editor.setNodeFlags(textId, { hidden: true });
const typeText = (editor: ReturnType<typeof useTemplateDesignEditor>, text: string) => {
  const document = editor.document!;
  const node = document.nodes[textId];
  editor.change({ ...document, nodes: { ...document.nodes, [textId]: { ...node, props: { ...node.props, text } } } });
};

const draftPath = (id: string) => `/api/tenant/core/v1/templates/${id}/draft`;
// Frozen synthetic Gateway control responses; portable under the ordinary Portal runner.
const gateway = {"timeout":{"status":504,"body":{"type":"https://errors.mutakamel.ai/gw/internal/error","title":"Internal server error","status":504,"code":"GW.INTERNAL.ERROR","instance":"/api/tenant/core/v1/templates/01890000-0000-7000-8000-000000000001/draft","correlationId":"ui03-independent-fixture"},"headers":{}},"forbidden":{"status":403,"body":{"type":"https://errors.mutakamel.ai/gw/auth/forbidden","title":"Forbidden","status":403,"code":"GW.AUTH.FORBIDDEN","correlationId":"ui03-independent-fixture","instance":"/api/tenant/core/v1/templates/01890000-0000-7000-8000-000000000001/draft"},"headers":{}},"limited":{"status":429,"body":{"type":"https://errors.mutakamel.ai/gw/rate/limit_exceeded","title":"Rate limit exceeded","status":429,"code":"GW.RATE.LIMIT_EXCEEDED","correlationId":"ui03-independent-fixture","instance":"/api/tenant/core/v1/templates/01890000-0000-7000-8000-000000000001/draft"},"headers":{"retry-after":"5"}}};
const wire = (response: typeof gateway.timeout) =>
  Response.json(response.body, { status: response.status, headers: response.headers });
const errorReply = (status: number, code: string, statusCode = status) =>
  Response.json({ success: false, statusCode, errorCode: code }, { status });
const savedReply = (base: typeof draft, init?: RequestInit) =>
  Response.json({ success: true, data: { draft: { ...base, revision: base.revision + 1,
    etag: `"${base.revision + 1}"`, editorDocument: JSON.parse(String(init?.body)).editorDocument } } });
function transportSession(sessionId: string) {
  sessionStorage.setItem("tenant_session_meta", JSON.stringify({
    sessionId, savedAt: Date.now(), expiresIn: 300, sessionExpiresIn: 300,
    tokenType: "Bearer", remember: false, authorizationVersion: 1, profileVersion: 1, authEventId: "composition-test",
  }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
async function realSave(onError?: (cause: unknown) => void) {
  const raw = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
  mocks.save.mockImplementation(async (...args: Parameters<typeof raw.saveTemplateDraft>) => {
    try { return await raw.saveTemplateDraft(...args); }
    catch (cause) { onError?.(cause); throw cause; }
  });
}
function writes(transport: ReturnType<typeof vi.fn<typeof fetch>>) {
  return transport.mock.calls.map(([url, init]) => {
    const headers = new Headers(init?.headers);
    return { url: String(url), method: init?.method, body: String(init?.body),
      key: headers.get("x-idempotency-key"), etag: headers.get("if-match") };
  });
}
function assertSameIntent(transport: ReturnType<typeof vi.fn<typeof fetch>>, count: number, etag = '"3"') {
  const attempts = writes(transport);
  expect(attempts).toHaveLength(count);
  expect(attempts[0]).toMatchObject({ method: "PATCH", etag, key: expect.stringMatching(/^[a-f0-9-]{14}7[a-f0-9-]{21}$/iu) });
  expect(attempts[0].url).toContain(draftPath(ID));
  expect(JSON.parse(attempts[0].body).clientMutationId).toBe(attempts[0].key);
  expect(attempts).toEqual(Array.from({ length: count }, () => attempts[0]));
  return attempts[0];
}

describe("visual editor concurrency and uncertain saves", () => {
  beforeEach(() => {
    route.generation = "tenant:session-a:actor";
    route.user.id = "actor";
    route.user.permissions = ["templates.read", "templates.update", "templates.preview"];
    route.user.permissionScopes["templates.read"] = { tenantWide: true, companyIds: [], branchIds: [] };
    route.user.permissionScopes["templates.update"] = { tenantWide: true, companyIds: [], branchIds: [] };
    transportSession("session-a");
    vi.resetAllMocks(); mocks.read.mockResolvedValue(draft); mocks.schema.mockResolvedValue({ fields: [], syntheticFixtures: [{ fixtureKey: "server.fixture", locale: "ar-EG" }] }); mocks.assets.mockResolvedValue({ items: [] });
  });
  afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });
  it("fences editing after an unknown save and replays the exact document, draft ETag and mutation ID", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Lost reply")).mockImplementationOnce(async (_id, edited) => ({ ...draft, editorDocument: edited, revision: 4, etag: '"4"' }));
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current)); await act(async () => { await result.current.save(); });
    expect(result.current.unknown).not.toBeNull(); const frozen = result.current.document;
    act(() => { result.current.reload(); });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    act(() => result.current.setNodeFlags(textId, { hidden: false })); expect(result.current.document).toBe(frozen);
    await act(async () => { await result.current.save(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.recover(); });
    expect(mocks.save.mock.calls[1].slice(0, 4)).toEqual(mocks.save.mock.calls[0].slice(0, 4));
    expect(mocks.save.mock.calls[0][2]).toBe('"3"');
    expect(result.current.unknown).toBeNull(); expect(result.current.draft?.revision).toBe(4); expect(result.current.dirty).toBe(false);
  });
  it("keeps a replay for a later revision pending until the original save is confirmed", async () => {
    const raw = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
    mocks.save.mockImplementation(raw.saveTemplateDraft);
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: false, code: "UPSTREAM_TIMEOUT" }, { status: 504 }))
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockImplementationOnce(async (_url, init) => Response.json({
        success: true, data: { draft: { ...draft, editorDocument: JSON.parse(String(init?.body)).editorDocument,
          revision: 5, etag: '"5"' } },
      }, { headers: { ETag: '"5"', "Idempotency-Replayed": "true" } }))
      .mockImplementationOnce(async (_url, init) => Response.json({
        success: true, data: { draft: { ...draft, editorDocument: JSON.parse(String(init?.body)).editorDocument,
          revision: 4, etag: '"4"' } },
      }, { headers: { ETag: '"4"', "Idempotency-Replayed": "true" } }));
    vi.stubGlobal("fetch", transport);
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.recover(); });
    expect(transport).not.toHaveBeenCalled();
    await act(async () => { await result.current.save(); });
    const intent = result.current.unknown;
    expect(intent).toMatchObject({ etag: '"3"' });
    await act(async () => { await result.current.save(); });
    expect(transport).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(intent);
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(intent);
    expect(result.current.draft?.revision).toBe(3);
    act(() => result.current.reload());
    expect(mocks.read).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.recover(); });
    expect(transport).toHaveBeenCalledTimes(4);
    for (const [url, init] of transport.mock.calls) {
      expect(String(url)).toContain(`/templates/${ID}/draft`);
      expect(new Headers(init?.headers).get("x-idempotency-key")).toBe(intent?.mutationId);
      expect(new Headers(init?.headers).get("if-match")).toBe('"3"');
      expect(String(init?.body)).toBe(String(transport.mock.calls[0][1]?.body));
    }
    expect(result.current.draft?.revision).toBe(4);
    expect(result.current.unknown).toBeNull();
  });

  it("loads a newer draft through Axios only after the raw GET receipt agrees", async () => {
    const raw = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
    const newer = { ...draft, revision: 5, etag: '"5"' };
    const headers = { ETag: newer.etag };
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: false, data: newer }, { headers }))
      .mockResolvedValueOnce(Response.json({ success: true, data: newer }, { headers }));
    vi.stubGlobal("fetch", transport);
    mocks.read.mockResolvedValueOnce(draft).mockImplementation(raw.fetchTemplateDraft);
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.draft?.revision).toBe(3));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loadFailure).toBe("failed"));
    expect(result.current.draft).toBeNull();
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.draft?.revision).toBe(5));
    expect(transport).toHaveBeenCalledTimes(2);
    for (const [url, init] of transport.mock.calls) {
      expect(String(url)).toContain(draftPath(ID));
      expect(init?.method).toBe("GET");
    }
  });

  it.each([
    { label: "legacy numeric replay", guarded: false, receipt: "canonical" },
    { label: "legacy numeric reply without replay evidence", guarded: false, receipt: "unmarked" },
    { label: "persisted composite replay", guarded: true, receipt: "canonical" },
    { label: "persisted composite replay with a composite response ETag", guarded: true, receipt: "composite" },
  ] as const)("checks a refreshed save with $label", async ({ guarded, receipt }) => {
    const { schemaChecksum } = salesOwnerSchema;
    const ifMatch = guarded ? `"draft-schema:${schemaChecksum}:3"` : draft.etag;
    if (guarded) mocks.schema.mockResolvedValueOnce({ fields: [], syntheticFixtures: [], schemaChecksum, draftSavePrecondition: "draft-schema" });
    const transport = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Response lost"));
    if (guarded) vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (guarded && init?.method === "GET") {
        expect(String(input)).toBe(salesSchemaEndpoint);
        return salesSchemaReply(salesOwnerSchema);
      }
      return transport(input, init);
    });
    await realSave();
    const first = renderHook(() => useTemplateDesignEditor(template, true, guarded ? salesOwnerRuntime : undefined));
    await waitFor(() => expect(first.result.current.editable).toBe(true));
    act(() => hideText(first.result.current));
    await act(async () => { await first.result.current.save(); });
    const original = writes(transport)[0];
    const keys = Object.keys(sessionStorage).filter(key => key.startsWith("sales-quotation:draft-save:"));
    expect(keys).toHaveLength(1);
    expect(JSON.parse(sessionStorage.getItem(keys[0])!)).toEqual({
      draftId: draft.draftId, revision: 3, mutationId: original.key, digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      ...(guarded && { ifMatch }),
    });
    const current = { ...draft, revision: 4, etag: '"4"', editorDocument: JSON.parse(original.body).editorDocument };
    first.unmount();
    mocks.read.mockResolvedValue(current);
    const next = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(next.result.current.refreshedSave?.canCheck).toBe(true));
    expect(next.result.current.unknown).toBeNull();
    act(() => next.result.current.setNodeFlags(textId, { hidden: false }));
    expect(next.result.current.document?.nodes[textId].hidden).toBe(true);
    await act(async () => { await next.result.current.save(); });
    expect(transport).toHaveBeenCalledOnce();
    transport.mockResolvedValueOnce(Response.json({ success: true, data: { draft: current } }, {
      headers: {
        ETag: receipt === "composite" ? ifMatch : current.etag,
        ...(receipt !== "unmarked" && { "Idempotency-Replayed": "true" }),
      },
    }));
    await act(async () => { await next.result.current.refreshedSave?.check(); });
    assertSameIntent(transport, 2, ifMatch);
    expect(transport.mock.calls[1][1]?.redirect).toBe("error");
    if (receipt === "canonical") {
      await waitFor(() => expect(next.result.current.refreshedSave).toBeNull());
      expect(sessionStorage.getItem(keys[0])).toBeNull();
      expect(next.result.current.draft).toMatchObject({ revision: 4, etag: '"4"' });
    } else {
      expect(next.result.current.refreshedSave).not.toBeNull();
      expect(next.result.current.refreshedSave?.unconfirmed).toBe(true);
      expect(sessionStorage.getItem(keys[0])).not.toBeNull();
    }
  });

  it("retries a failed Sales Save verification in place and waits for explicit Save", async () => {
    const scope = { type: "COMPANY", companyId: "01890000-0000-7000-8000-000000000021" } as const;
    const scopedTemplate = { ...template, scope };
    const grant = { tenantWide: false, companyIds: [scope.companyId], branchIds: [] };
    route.user.permissions = ["templates.read", "templates.update"];
    route.user.permissionScopes["templates.read"] = grant;
    route.user.permissionScopes["templates.update"] = grant;
    route.readyProfile.mockReturnValue({ user: route.user, sessionRevision: '["session-a",1,1]', sequence: 1 });
    vi.stubGlobal("crypto", webcrypto);
    const admission = await readTemplateOwnerAdmission(salesOwnerSchema, salesOwnerRuntime);
    if (!admission) throw new Error("Sales Quotation fixture failed owner admission");
    const { descriptorChecksum } = admission;
    mocks.schema.mockResolvedValue({ ...salesOwnerSchema, draftSavePrecondition: "draft-schema" });
    const readback = deferred<void>();
    const observer = vi.spyOn(salesQuotationOrigin, "observeSalesQuotationOrigin")
      .mockResolvedValue(null)
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async ({ detail, draft, authorityKey, generation, readOrigin, isCurrent }) => {
        await readback.promise;
        const identity = { tenantOrigin: readOrigin(), companyId: scope.companyId, generation, isCurrent };
        return {
          owner: { ...identity, admission, authorityKey },
          authority: { ...identity, detail, draft, key: authorityKey },
          trust: { pins: admission.pins, descriptorCanonicalSha256: admission.descriptorCanonicalSha256, isCurrent },
          saveDescriptorChecksum: descriptorChecksum,
        };
      });
    try {
      const transport = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => savedReply(draft, init));
      vi.stubGlobal("fetch", transport);
      await realSave();
      const { result } = renderHook(() => useTemplateDesignEditor(scopedTemplate, true));
      await waitFor(() => expect(result.current.saveAuthority).toBe("unavailable"));
      act(() => typeText(result.current, "Unsaved edit"));
      const store = result.current.commandStore;
      const snapshot = store.getSnapshot();
      const savedDraft = result.current.draft;

      act(() => result.current.retrySaveVerification!());
      await waitFor(() => expect(observer).toHaveBeenCalledTimes(2));
      expect(result.current.saveAuthority).toBe("waiting");
      expect(transport).not.toHaveBeenCalled();

      await act(async () => { readback.resolve(); });
      await waitFor(() => expect(result.current.saveAuthority).toBeNull());
      expect(result.current.draft).toBe(savedDraft);
      expect(result.current.commandStore).toBe(store);
      expect(store.getSnapshot()).toBe(snapshot);
      expect(result.current.canUndo).toBe(true);
      expect(transport).not.toHaveBeenCalled();
      expect(Object.keys(sessionStorage).some(key => key.startsWith("sales-quotation:draft-save:"))).toBe(false);

      await act(async () => { await result.current.save(); });
      const saved = assertSameIntent(transport, 1, '"draft-schema:' + descriptorChecksum + ':3"');
      expect(JSON.parse(saved.body).editorDocument.nodes[textId].props.text).toBe("Unsaved edit");
      expect(result.current.draft?.etag).toBe('"4"');
    } finally {
      readback.resolve();
      observer.mockRestore();
      route.readyProfile.mockReturnValue(null);
    }
  });

  it.each([false, true])("qualifies same-Company typing before any write (route retired: %s)", async retired => {
    const scope = { type: "COMPANY", companyId: "01890000-0000-7000-8000-000000000021" } as const;
    const scopedTemplate = { ...template, scope };
    const grant = { tenantWide: false, companyIds: [scope.companyId], branchIds: [] };
    route.user.permissionScopes["templates.read"] = grant;
    route.user.permissionScopes["templates.update"] = grant;
    route.readyProfile.mockReturnValue({ user: route.user, sessionRevision: '["session-a",1,1]', sequence: 1 });
    vi.stubGlobal("crypto", webcrypto);
    // jsdom's History API does not dispatch the native Navigation API event.
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const href = window.location.href;
    const historyState = window.history.state;
    const admission = await readTemplateOwnerAdmission(salesOwnerSchema, salesOwnerRuntime);
    if (!admission) throw new Error("Sales Quotation fixture failed owner admission");
    mocks.schema.mockResolvedValue({ ...salesOwnerSchema, draftSavePrecondition: "draft-schema" });
    const readback = deferred<void>();
    const observer = vi.spyOn(salesQuotationOrigin, "observeSalesQuotationOrigin")
      .mockImplementation(async ({ detail, draft, authorityKey, generation, readOrigin, isCurrent }) => {
        if (getStoredTenantSessionMeta()?.authorizationVersion === 2) await readback.promise;
        const identity = { tenantOrigin: readOrigin(), companyId: scope.companyId, generation, isCurrent };
        return {
          owner: { ...identity, admission, authorityKey },
          authority: { ...identity, detail, draft, key: authorityKey },
          trust: { pins: admission.pins, descriptorCanonicalSha256: admission.descriptorCanonicalSha256, isCurrent },
          saveDescriptorChecksum: admission.descriptorChecksum,
        };
      });
    const transport = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    try {
      await realSave();
      const first = renderHook(() => useTemplateDesignEditor(scopedTemplate, true));
      await waitFor(() => {
        expect(first.result.current.editable).toBe(true);
        expect(observer).toHaveBeenCalled();
        expect(first.result.current.saveAuthority).toBeNull();
      });
      const text = "Unsent Company terms.";
      act(() => typeText(first.result.current, text));
      expect(synchronizeTenantTabSession({ realm: "tenant", kind: "session-updated", eventId: "editor-rollover",
        sourceId: "independent-tab", sessionId: "session-a", issuedAt: Date.now(),
        timing: { expiresIn: 300, sessionExpiresIn: 300, authorizationVersion: 2, profileVersion: 2 },
      })).toBe(true);
      first.unmount();
      if (retired) {
        for (const url of [new URL("/core/templates", href).href, href]) {
          navigation.dispatchEvent(Object.assign(new Event("navigate"), { destination: { url }, navigationType: "push" }));
          window.history.pushState(null, "", url);
        }
        expect(window.location.href).toBe(href);
      }
      route.readyProfile.mockReturnValue({ user: route.user, sessionRevision: '["session-a",2,2]', sequence: 2 });
      mocks.read.mockClear();
      observer.mockClear();
      const reopened = renderHook(() => useTemplateDesignEditor(scopedTemplate, true));
      await waitFor(() => {
        expect(reopened.result.current.saveAuthority).toBe("waiting");
        expect(observer).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ id: ID, scope }) }));
      });
      expect(mocks.read).toHaveBeenCalledTimes(1);
      expect(reopened.result.current.document?.nodes[textId].props.text).toBe(document.nodes[textId].props.text);
      expect(transport).not.toHaveBeenCalled();

      await act(async () => { readback.resolve(); });
      await waitFor(() => expect(reopened.result.current.saveAuthority).toBeNull());
      expect(reopened.result.current.document?.nodes[textId].props.text).toBe(retired ? document.nodes[textId].props.text : text);
      expect(reopened.result.current.draft?.editorDocument).toEqual(document);
      expect(reopened.result.current.dirty).toBe(!retired);
      expect(mocks.save).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
      expect(Object.keys(sessionStorage).some(key => key.startsWith("sales-quotation:draft-save:"))).toBe(false);
      if (!retired) {
        await act(async () => { await reopened.result.current.save(); });
        const saved = assertSameIntent(transport, 1, '"draft-schema:' + admission.descriptorChecksum + ':3"');
        expect(JSON.parse(saved.body).editorDocument.nodes[textId].props.text).toBe(text);
      }
    } finally {
      readback.resolve();
      discardSalesDraftTypingRollover();
      observer.mockRestore();
      route.readyProfile.mockReturnValue(null);
      if (retired) window.history.replaceState(historyState, "", href);
    }
  });

  it.each(["same owner", "sibling-only grants"])("keeps the Company recovery hidden through a stale workspace (%s)", async outcome => {
    const scope = { type: "COMPANY", companyId: "01890000-0000-7000-8000-000000000021" } as const;
    const grantTo = (companyId: string) => {
      const grant = { tenantWide: false, companyIds: [companyId], branchIds: [] };
      route.user.permissionScopes["templates.read"] = grant;
      route.user.permissionScopes["templates.update"] = grant;
    };
    const profile = (version: number) => route.readyProfile.mockReturnValue({
      user: route.user, sessionRevision: JSON.stringify(["session-a", version, version]), sequence: version,
    });
    const admission = await readTemplateOwnerAdmission(salesOwnerSchema, salesOwnerRuntime);
    if (!admission) throw new Error("Sales Quotation fixture failed owner admission");
    const freshOwner = deferred<void>();
    const observer = vi.spyOn(salesQuotationOrigin, "observeSalesQuotationOrigin").mockImplementation(async input => {
      const { profile, detail, draft, authorityKey, generation, readOrigin, isCurrent } = input;
      if (profile.sequence === 2) await freshOwner.promise;
      const identity = { tenantOrigin: readOrigin(), companyId: scope.companyId, generation, isCurrent };
      return {
        owner: { ...identity, admission, authorityKey },
        authority: { ...identity, detail, draft, key: authorityKey },
        trust: { pins: admission.pins, descriptorCanonicalSha256: admission.descriptorCanonicalSha256, isCurrent },
        saveDescriptorChecksum: admission.descriptorChecksum,
      };
    });
    const localText = "Company terms typed before the held profile.";
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected test transport"));
    const view = () => createElement(TemplateDesignWorkspace, { id: ID });
    route.editorProbe = function EditorProbe({ template, canMutate, draftRefresh }) {
      const editor = useTemplateDesignEditor(template, canMutate, undefined, draftRefresh);
      return createElement("div", null,
        createElement("output", { "aria-label": "Company draft text" }, editor.document?.nodes[textId].props.text as string),
        createElement("button", { type: "button", disabled: !editor.editable || editor.saveAuthority !== null,
          onClick: () => typeText(editor, localText) }, "Type Company terms"));
    };
    try {
      grantTo(scope.companyId);
      profile(1);
      route.fetch.mockResolvedValue({ ...template, scope });
      mocks.schema.mockResolvedValue({ ...salesOwnerSchema, draftSavePrecondition: "draft-schema" });
      vi.stubGlobal("crypto", webcrypto);
      vi.stubGlobal("fetch", transport);
      // jsdom exposes the History API without the native Navigation API.
      vi.stubGlobal("navigation", new EventTarget());
      const workspace = render(view());
      const typeButton = await screen.findByRole("button", { name: "Type Company terms" });
      await waitFor(() => expect(typeButton).toHaveProperty("disabled", false));
      act(() => { typeButton.click(); });
      expect(screen.getByLabelText("Company draft text").textContent).toBe(localText);

      expect(synchronizeTenantTabSession({ realm: "tenant", kind: "session-updated", eventId: "stale-workspace-v2",
        sourceId: "independent-tab", sessionId: "session-a", issuedAt: Date.now(),
        timing: { expiresIn: 300, sessionExpiresIn: 300, authorizationVersion: 2, profileVersion: 2 },
      })).toBe(true);
      route.authState = "STALE";
      route.readyProfile.mockReturnValue(null);
      workspace.rerender(view());
      // Keeping the child mounted exercises its layout cleanup before the parent's layout effect.
      expect(screen.getByRole("button", { name: "Type Company terms" })).toBe(typeButton);
      expect(screen.getByLabelText("Company draft text").textContent).toBe("");

      route.authState = "AUTHENTICATED";
      if (outcome === "sibling-only grants") grantTo("01890000-0000-7000-8000-000000000022");
      profile(2);
      workspace.rerender(view());
      if (outcome === "sibling-only grants") {
        expect(await screen.findByText("Denied")).toBeTruthy();
        expect(screen.queryByLabelText("Company draft text")).toBeNull();
        expect(takeSalesDraftTypingRollover()).toBeNull();
      } else {
        await waitFor(() => expect(observer).toHaveBeenCalledWith(expect.objectContaining({
          profile: expect.objectContaining({ sequence: 2 }),
        })));
        expect(screen.getByLabelText("Company draft text").textContent).toBe(document.nodes[textId].props.text);
        await act(async () => { freshOwner.resolve(); });
        expect(screen.getByLabelText("Company draft text").textContent).toBe(localText);
      }
      expect(mocks.save).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    } finally {
      freshOwner.resolve();
      discardSalesDraftTypingRollover();
      observer.mockRestore();
      route.editorProbe = null;
      route.authState = "AUTHENTICATED";
      route.readyProfile.mockReturnValue(null);
    }
  });

  it("keeps a mixed schema 200 readable and blocks Save despite the valid marker and current HTTP ETag", async () => {
    const current = { ...salesOwnerSchema, capabilities: { draftSavePrecondition: { kind: "draft-schema", scope: template.scope } } };
    const formerChecksum = "a".repeat(64);
    expect(current.schemaChecksum).not.toBe(formerChecksum);
    const currentETag = `"${createHash("sha256").update(JSON.stringify(current)).digest("hex")}"`;
    const mixed = salesSchemaReply({ ...current, schemaChecksum: formerChecksum }, currentETag);
    const raw = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
    vi.stubGlobal("crypto", webcrypto);
    const schemaRead = vi.fn<typeof fetch>().mockResolvedValueOnce(mixed);
    vi.stubGlobal("fetch", schemaRead);
    const schema = await raw.fetchTemplateDataSchema(source.dataSourceKey, template.scope);
    expect(schemaRead).toHaveBeenCalledExactlyOnceWith(salesSchemaEndpoint, expect.objectContaining({ method: "GET" }));
    expect(schema).toMatchObject({ schemaChecksum: formerChecksum, draftSavePrecondition: "draft-schema" });
    mocks.schema.mockResolvedValue(schema);

    const ownerRead = vi.fn(() => salesSchemaReply(salesOwnerSchema, currentETag));
    const writesOnly = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "GET") {
        expect(String(input)).toBe(salesSchemaEndpoint);
        return ownerRead();
      }
      return writesOnly(input, init);
    });
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true, salesOwnerRuntime));
    await waitFor(() => expect(result.current.editable).toBe(true));
    expect(ownerRead).toHaveBeenCalledOnce();
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(writesOnly).not.toHaveBeenCalled();
    expect(result.current.saveAuthority).toBe("unavailable");
    expect(result.current.dirty).toBe(true);
    expect(result.current.document?.nodes[textId].hidden).toBe(true);
    expect(result.current.draft?.etag).toBe('"3"');
  });

  it.each([
    { outcome: "pins the confirmed checkpoint for the next edit", advanced: false },
    { outcome: "keeps the next edit blocked when readback has advanced", advanced: true },
  ])("$outcome after reopening a Sales draft with a lost save response", async ({ advanced }) => {
    const raw = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
    mocks.read.mockImplementation(raw.fetchTemplateDraft);
    mocks.save.mockImplementation(raw.saveTemplateDraft);
    let current = draft;
    let originalKey: string | null = null;
    let originalReceipt: typeof draft | undefined;
    let reads = 0;
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      expect(new URL(String(url), window.location.origin).pathname).toBe(draftPath(ID));
      if (init?.method === "GET") {
        reads += 1;
        // A failed read after confirmation must not displace the admitted checkpoint.
        if (reads > 4) return new Response(null, { status: 503 });
        if (advanced && reads === 4) current = { ...current, revision: 5, etag: '"5"' };
        return Response.json({ success: true, data: current }, { headers: { ETag: current.etag } });
      }

      expect(init?.method).toBe("PATCH");
      const headers = new Headers(init?.headers);
      const key = headers.get("x-idempotency-key");
      if (originalReceipt && key === originalKey) {
        return Response.json({ success: true, data: { draft: originalReceipt } }, {
          headers: { ETag: originalReceipt.etag, "Idempotency-Replayed": "true" },
        });
      }

      if (headers.get("if-match") !== current.etag) return new Response(null, { status: 412 });
      const body = JSON.parse(String(init?.body)) as { editorDocument: EditorDocument };
      const revision = current.revision + 1;
      current = { ...current, revision, etag: `"${revision}"`, editorDocument: body.editorDocument };
      if (!originalReceipt) {
        originalReceipt = current;
        originalKey = key;
        throw new Error("Response lost after commit");
      }
      return Response.json({ success: true, data: { draft: current } }, { headers: { ETag: current.etag } });
    });
    vi.stubGlobal("fetch", transport);

    const first = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(first.result.current.editable).toBe(true));
    act(() => hideText(first.result.current));
    await act(async () => { await first.result.current.save(); });
    expect(first.result.current.unknown).toMatchObject({ etag: '"3"', mutationId: originalKey });
    expect(current).toMatchObject({ revision: 4, etag: '"4"' });
    const checkpoint = current;
    const storageKey = Object.keys(sessionStorage).find(key => key.startsWith("sales-quotation:draft-save:"))!;
    const retained = sessionStorage.getItem(storageKey);
    expect(retained).not.toBeNull();
    first.unmount();

    const next = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(next.result.current.refreshedSave?.canCheck).toBe(true));
    await act(async () => { await next.result.current.refreshedSave?.check(); });
    expect(next.result.current.draft).toEqual(checkpoint);
    expect(writes(transport).map(call => call.method)).toEqual(["GET", "PATCH", "GET", "GET", "PATCH", "GET"]);
    const readback = await mocks.read.mock.results[3].value;
    const [initial, replay] = writes(transport).filter(call => call.method === "PATCH");
    expect(replay).toEqual(initial);

    if (advanced) {
      expect(readback).toMatchObject({ revision: 5, etag: '"5"' });
      expect(next.result.current.refreshedSave?.unconfirmed).toBe(true);
      expect(next.result.current.hasPending).toBe(true);
      expect(sessionStorage.getItem(storageKey)).toBe(retained);
      act(() => next.result.current.setNodeFlags(bodyId, { locked: true }));
      await act(async () => { await next.result.current.save(); });
      expect(next.result.current.document).toEqual(checkpoint.editorDocument);
      expect(writes(transport).filter(call => call.method === "PATCH")).toHaveLength(2);
      return;
    }

    expect(next.result.current.draft).toBe(readback);
    expect(next.result.current.refreshedSave).toBeNull();
    expect(next.result.current.hasPending).toBe(false);
    expect(next.result.current.dirty).toBe(false);
    expect(next.result.current.document).toEqual(checkpoint.editorDocument);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    act(() => next.result.current.setNodeFlags(bodyId, { locked: true }));
    expect(next.result.current.dirty).toBe(true);
    await act(async () => { await next.result.current.save(); });
    const patches = writes(transport).filter(call => call.method === "PATCH");
    expect(patches).toHaveLength(3);
    const second = patches[2];
    expect(second.etag).toBe('"4"');
    expect(second.key).toBeTruthy();
    expect(second.key).not.toBe(initial.key);
    expect(JSON.parse(second.body)).toEqual({ editorDocument: current.editorDocument, clientMutationId: second.key });
    expect(current.editorDocument.nodes[textId].hidden).toBe(true);
    expect(current.editorDocument.nodes[bodyId].locked).toBe(true);
    expect(next.result.current.draft).toEqual(current);
    expect(next.result.current.draft?.etag).toBe('"5"');
    expect(next.result.current.dirty).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it.each(["exact", "wrong draft", "wrong actor", "wrong scope", "competing revision", "changed saved content", "discard", "sign-out"])(
    "restores unsaved typing only from the exact recovered Sales checkpoint (%s)", async outcome => {
      const transport = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Response lost after commit"));
      vi.stubGlobal("fetch", transport);
      await realSave();
      const first = renderHook(() => useTemplateDesignEditor(template, true));
      await waitFor(() => expect(first.result.current.editable).toBe(true));
      act(() => typeText(first.result.current, "Approved delivery"));
      await act(async () => { await first.result.current.save(); });
      const original = writes(transport)[0];
      const checkpoint = { ...draft, revision: 4, etag: '"4"', editorDocument: JSON.parse(original.body).editorDocument };
      const typingKey = Object.keys(sessionStorage).find(key => key.startsWith(SALES_DRAFT_TYPING_PREFIX))!;
      expect(JSON.parse(sessionStorage.getItem(typingKey)!)).toMatchObject({ draftId: draft.draftId, revision: 3 });
      first.unmount();

      mocks.read.mockResolvedValue(checkpoint);
      transport.mockResolvedValueOnce(Response.json({ success: true, data: { draft: checkpoint } }, {
        headers: { "Idempotency-Replayed": "true", ETag: checkpoint.etag },
      }));
      const recovered = renderHook(() => useTemplateDesignEditor(template, true));
      await waitFor(() => expect(recovered.result.current.refreshedSave?.canCheck).toBe(true));
      await act(async () => { await recovered.result.current.refreshedSave?.check(); });
      expect(recovered.result.current.draft).toEqual(checkpoint);
      expect(recovered.result.current.dirty).toBe(false);
      expect(sessionStorage.getItem(typingKey)).toBeNull();
      const typing = "Approved delivery. Freight included.";
      act(() => typeText(recovered.result.current, typing));
      expect(JSON.parse(sessionStorage.getItem(typingKey)!)).toMatchObject({
        templateId: ID, draftId: draft.draftId, revision: 4, etag: '"4"', edits: [[textId, typing]],
      });
      if (outcome === "discard") act(() => recovered.result.current.discardRetainedTyping());
      if (outcome === "sign-out") {
        clearLocalTenantAuthState();
        expect(sessionStorage.getItem(typingKey)).toBeNull();
        transportSession("session-a");
      }
      recovered.unmount();

      let reopenedTemplate = template;
      let remote = checkpoint;
      if (outcome === "wrong actor") {
        route.user.id = "actor-b";
        route.generation = "tenant:session-a:actor-b";
      }
      if (outcome === "wrong scope") {
        const companyId = "01890000-0000-7000-8000-000000000098";
        for (const permission of ["templates.read", "templates.update"] as const) {
          route.user.permissionScopes[permission].companyIds.push(companyId);
        }
        reopenedTemplate = { ...template, scope: { type: "COMPANY", companyId } };
      }
      if (outcome === "wrong draft") remote = { ...checkpoint, draftId: bodyId };
      if (outcome === "competing revision" || outcome === "changed saved content") {
        const node = checkpoint.editorDocument.nodes[textId];
        const editorDocument = { ...checkpoint.editorDocument, nodes: { ...checkpoint.editorDocument.nodes,
          [textId]: { ...node, props: { ...node.props, text: "Competing saved text" } } } };
        remote = outcome === "competing revision" ? { ...checkpoint, editorDocument, revision: 5, etag: '"5"' }
          : { ...checkpoint, editorDocument };
      }
      mocks.read.mockResolvedValue(remote);
      const reopened = renderHook(() => useTemplateDesignEditor(reopenedTemplate, true));
      await waitFor(() => expect(reopened.result.current.draft).toEqual(remote));
      expect(reopened.result.current.dirty).toBe(outcome === "exact");
      expect(reopened.result.current.document?.nodes[textId].props.text).toBe(
        outcome === "exact" ? typing : remote.editorDocument.nodes[textId].props.text);
      expect(reopened.result.current.draft?.editorDocument).toEqual(remote.editorDocument);
      assertSameIntent(transport, 2);

      if (outcome === "exact") {
        transport.mockImplementationOnce(async (_url, init) => savedReply(checkpoint, init));
        await act(async () => { await reopened.result.current.save(); });
        const writesMade = writes(transport);
        expect(writesMade).toHaveLength(3);
        expect(writesMade[2].etag).toBe('"4"');
        expect(writesMade[2].key).not.toBe(original.key);
        expect(reopened.result.current.draft?.editorDocument.nodes[textId].props.text).toBe(typing);
        expect(reopened.result.current.draft?.revision).toBe(5);
        expect(sessionStorage.getItem(typingKey)).toBeNull();
      }
    },
  );

  it("keeps a refreshed save unresolved if a newer draft wins before readback completes", async () => {
    const replayReply = deferred<Response>();
    const transport = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementationOnce(() => replayReply.promise);
    vi.stubGlobal("fetch", transport);
    await realSave();
    const first = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(first.result.current.editable).toBe(true));
    act(() => hideText(first.result.current));
    await act(async () => { await first.result.current.save(); });
    const saved = { ...draft, revision: 4, etag: '"4"', editorDocument: first.result.current.document! };
    first.unmount();

    mocks.read.mockResolvedValue(saved);
    const next = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(next.result.current.refreshedSave?.canCheck).toBe(true));
    let checking!: Promise<void>;
    act(() => { checking = next.result.current.refreshedSave!.check(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));

    mocks.read.mockResolvedValue({ ...saved, revision: 5, etag: '"5"', editorDocument: document });
    await act(async () => {
      replayReply.resolve(Response.json({ success: true, data: { draft: saved, migrationRecovery: null } }, {
        headers: { "idempotency-replayed": "true", etag: saved.etag },
      }));
      await checking;
    });
    expect(next.result.current.refreshedSave?.unconfirmed).toBe(true);
    expect(next.result.current.hasPending).toBe(true);
    expect(mocks.read).toHaveBeenCalledTimes(4);
    const key = Object.keys(sessionStorage).find(key => key.startsWith("sales-quotation:draft-save:"));
    expect(key).toBeDefined();
    assertSameIntent(transport, 2);

    await act(async () => { await next.result.current.refreshedSave?.check(); });
    expect(next.result.current.refreshedSave?.unconfirmed).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each(["base revision", "later revision", "changed content", "different draft"])("keeps a refreshed save unresolved for %s", async reason => {
    mocks.save.mockRejectedValue(new Error("Response lost"));
    const first = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(first.result.current.editable).toBe(true));
    act(() => hideText(first.result.current));
    await act(async () => { await first.result.current.save(); });
    const edited = first.result.current.document!;
    first.unmount();
    const revision = reason === "base revision" ? 3 : reason === "later revision" ? 5 : 4;
    const latest = { ...draft, revision, etag: `"${revision}"`, draftId: reason === "different draft" ? bodyId : draft.draftId,
      editorDocument: reason === "changed content" ? document : edited };
    mocks.read.mockResolvedValue(latest);
    const next = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(next.result.current.refreshedSave?.canCheck).toBe(true));
    await act(async () => { await next.result.current.refreshedSave?.check(); });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(next.result.current.hasPending).toBe(true);
    expect(next.result.current.refreshedSave?.unconfirmed).toBe(true);
    act(() => next.result.current.refreshedSave?.discard());
    await waitFor(() => expect(next.result.current.draft?.revision).toBe(revision));
    expect(next.result.current.hasPending).toBe(false);
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it.each(["scope", "session", "write grant", "authorization version"])("fences a refreshed check when the %s changes during its GET", async boundary => {
    const companyId = "01890000-0000-7000-8000-000000000098";
    mocks.save.mockRejectedValue(new Error("Response lost"));
    const first = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(first.result.current.editable).toBe(true));
    act(() => hideText(first.result.current));
    await act(async () => { await first.result.current.save(); });
    const current = { ...draft, revision: 4, etag: '"4"', editorDocument: first.result.current.document! };
    first.unmount();
    mocks.read.mockResolvedValue(current);
    const next = renderHook(({ value, allowed }) => useTemplateDesignEditor(value, allowed),
      { initialProps: { value: template, allowed: true } });
    await waitFor(() => expect(next.result.current.refreshedSave?.canCheck).toBe(true));
    const latest = deferred<typeof current>();
    mocks.read.mockImplementationOnce(() => latest.promise);
    let checking!: Promise<void>;
    act(() => {
      checking = next.result.current.refreshedSave!.check();
      void next.result.current.refreshedSave!.check();
    });
    expect(mocks.read).toHaveBeenCalledTimes(3);
    if (boundary === "session") {
      transportSession("session-b");
      route.generation = "tenant:session-b:actor";
    }
    if (boundary === "authorization version") sessionStorage.setItem("tenant_session_meta", JSON.stringify({
      ...getStoredTenantSessionMeta(), authorizationVersion: 2,
    }));
    next.rerender({ value: boundary === "scope" ? { ...template, scope: { type: "COMPANY", companyId } } : template,
      allowed: boundary !== "write grant" });
    await act(async () => { latest.resolve(current); await checking; });
    expect(mocks.save).toHaveBeenCalledOnce();
    if (boundary === "scope" || boundary === "session") expect(next.result.current.refreshedSave).toBeNull();
    expect(Object.keys(sessionStorage).filter(key => key.startsWith("sales-quotation:draft-save:"))).toHaveLength(1);
  });

  it("keeps the local draft read-only across policy changes and blocks retained mutation callbacks", async () => {
    const { result, rerender } = renderHook(({ allowed }) => useTemplateDesignEditor(template, allowed),
      { initialProps: { allowed: true } });
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    const authored = result.current.document;
    const oldSave = result.current.save;
    const oldEdit = result.current.setNodeFlags;
    rerender({ allowed: false });
    act(() => oldEdit(textId, { hidden: false }));
    await act(async () => { await oldSave(); await result.current.recover(); });
    expect(result.current.document).toBe(authored);
    expect(result.current.editable).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("refuses a newer reply for another draft and retains the original recovery intent", async () => {
    mocks.save.mockResolvedValue({ ...draft, draftId: "01890000-0000-7000-8000-000000000005", revision: 4, etag: '"4"' });
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(result.current.draft?.revision).toBe(3);
    expect(result.current.unknown).toMatchObject({ etag: '"3"' });
  });

  it("keeps edits and allows a new save after a confirmed schema conflict", async () => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        success: false,
        statusCode: 409,
        errorCode: "CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED",
        path: draftPath(ID),
      }, { status: 409 }))
      .mockImplementationOnce(async (_url, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    const authored = result.current.document;

    await act(async () => { await result.current.save(); });
    expect(result.current.error).toBe("Schema changed");
    expect(result.current.draft?.revision).toBe(3);
    expect(result.current.document).toBe(authored);
    expect(result.current.unknown).toBeNull();
    expect(result.current.conflict).toBe(false);
    expect(transport).toHaveBeenCalledOnce();

    await act(async () => { await result.current.save(); });
    const [rejected, retried] = writes(transport);
    expect(retried.key).not.toBe(rejected.key);
    expect(retried.etag).toBe(rejected.etag);
    expect(result.current.draft?.revision).toBe(4);
  });

  it.each([409, 412])("retains the original intent after an unconfirmed first-save %i", async status => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(errorReply(status, "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION"))
      .mockImplementationOnce(async (_url, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    const authored = result.current.document;
    await act(async () => { await result.current.save(); });
    expect(result.current.unknown).toMatchObject({ etag: '"3"' });
    expect(result.current.conflict).toBe(false);
    expect(result.current.document).toBe(authored);
    act(() => result.current.reload());
    expect(mocks.read).toHaveBeenCalledOnce();
    await act(async () => { await result.current.save(); });
    expect(transport).toHaveBeenCalledOnce();
    await act(async () => { await result.current.recover(); });
    assertSameIntent(transport, 2);
    expect(result.current.unknown).toBeNull();
    expect(result.current.draft?.revision).toBe(4);
  });

  it("treats a confirmed archived-definition rejection on the first save as a definite failure", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: false, statusCode: 409, errorCode: "CORE.TEMPLATE.DEFINITION.ARCHIVED", path: draftPath(ID),
    }, { status: 409 }));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toBe("Failed");
    expect(result.current.unknown).toBeNull();
    expect(result.current.conflict).toBe(false);
    expect(result.current.dirty).toBe(true);
  });

  it.each([409, 412])("keeps a route-less stale %i unresolved and accepts a confirmed conflict", async status => {
    const nextBase = { ...draft, revision: 4, etag: '"4"' };
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockResolvedValueOnce(errorReply(409, "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT"))
      .mockResolvedValueOnce(errorReply(status, "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION"))
      .mockResolvedValueOnce(Response.json({
        success: false, statusCode: status, errorCode: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION", path: draftPath(ID),
      }, { status }))
      .mockImplementationOnce(async (_url, init) => savedReply(nextBase, init));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    const authored = result.current.document;
    await act(async () => { await result.current.save(); });
    const original = result.current.unknown;
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(original);
    expect(result.current.conflict).toBe(false);
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(original);
    expect(result.current.conflict).toBe(false);
    await act(async () => { await result.current.recover(); });
    expect(result.current.conflict).toBe(true);
    expect(result.current.unknown).toBeNull();
    expect(result.current.document).toBe(authored);
    await act(async () => { await result.current.save(); await result.current.recover(); });
    const prior = assertSameIntent(transport, 4);
    mocks.read.mockResolvedValueOnce(nextBase);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.draft?.etag).toBe('"4"'));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(result.current.draft?.revision).toBe(5);
    expect(writes(transport)[4]).toMatchObject({ etag: '"4"' });
    expect(writes(transport)[4].key).not.toBe(prior.key);
  });

  it("retains the same draft intent after the exact Axios A to B to A fence and requires explicit recovery", async () => {
    const delayed = deferred<Response>();
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockImplementationOnce(() => delayed.promise)
      .mockImplementationOnce(async (_url, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    let localFence: unknown;
    await realSave(cause => {
      if (cause instanceof TenantApiClientError && cause.response.data.errorCode === "AUTH_SESSION_CHANGED") {
        localFence = cause;
        expect(getStoredTenantSessionMeta()?.sessionId).toBe("session-b");
        transportSession("session-a");
      }
    });
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    const original = result.current.unknown;
    let pending!: Promise<void>;
    act(() => { pending = result.current.recover(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    const renderInA = result.current;
    await act(async () => {
      transportSession("session-b");
      expect(result.current).toBe(renderInA);
      delayed.resolve(savedReply(draft, transport.mock.calls[1][1]));
      await pending;
    });
    expect(localFence).toMatchObject({ provenance: "client", response: { status: 409 } });
    expect(result.current.draft?.etag).toBe('"3"');
    expect(result.current.saving).toBe(false);
    expect(result.current.unknown).toEqual(original);
    expect(result.current.conflict).toBe(false);
    await act(async () => { await result.current.save(); });
    assertSameIntent(transport, 2);
    await act(async () => { await result.current.recover(); });
    assertSameIntent(transport, 3);
    expect(result.current.unknown).toBeNull();
    expect(result.current.draft?.etag).toBe('"4"');
  });

  it.each([
    { scenario: "unchanged", authorizationVersion: 1 },
    { scenario: "advanced", authorizationVersion: 2 },
  ])("checks an in-memory Recover receipt when the same session authorization version is $scenario", async ({ authorizationVersion }) => {
    const reply = deferred<Response>();
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockImplementationOnce(() => reply.promise)
      .mockImplementationOnce(async (_url, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    const original = result.current.unknown!;
    const first = assertSameIntent(transport, 1);
    expect(original.mutationId).toBe(first.key);

    let recovering!: Promise<void>;
    act(() => { recovering = result.current.recover(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    const rendered = result.current;
    const session = getStoredTenantSessionMeta()!;
    expect(session).toMatchObject({ sessionId: "session-a", authorizationVersion: 1 });

    await act(async () => {
      expect(synchronizeTenantTabSession({
        realm: "tenant", kind: "session-updated", eventId: "same-session-recovery-update",
        sourceId: "independent-tab", issuedAt: Date.now(), sessionId: session.sessionId,
        timing: { expiresIn: 300, sessionExpiresIn: 300, authorizationVersion, profileVersion: 2 },
      })).toBe(true);
      expect(getStoredTenantSessionMeta()).toMatchObject({ sessionId: session.sessionId, authorizationVersion, profileVersion: 2 });
      expect(result.current).toBe(rendered);
      const replay = savedReply(draft, transport.mock.calls[1][1]);
      replay.headers.set("idempotency-replayed", "true");
      reply.resolve(replay);
      await recovering;
    });

    assertSameIntent(transport, 2);
    const retainedCommands = () => Object.keys(sessionStorage).filter(key => key.startsWith("sales-quotation:draft-save:")).length;
    if (authorizationVersion !== session.authorizationVersion) {
      expect({
        revision: result.current.draft?.revision,
        etag: result.current.draft?.etag,
        unresolvedMutationId: result.current.unknown?.mutationId,
        retainedCommands: retainedCommands(),
      }).toEqual({ revision: 3, etag: '"3"', unresolvedMutationId: original.mutationId, retainedCommands: 1 });

      await act(async () => { await result.current.recover(); });
      assertSameIntent(transport, 3);
    }
    expect(result.current.unknown).toBeNull();
    expect(result.current.draft).toMatchObject({ revision: 4, etag: '"4"' });
    expect(retainedCommands()).toBe(0);
  });

  it.each([200, 403])("isolates a previous company Save/Recover HTTP %i after branch regrant", async status => {
    const companyId = "01890000-0000-7000-8000-000000000021";
    const nextCompanyId = "01890000-0000-7000-8000-000000000022";
    const branchId = "01890000-0000-7000-8000-000000000023";
    const branchDefinitionId = "01890000-0000-7000-8000-000000000024";
    const company: TemplateDetail = { ...template, scope: { type: "COMPANY", companyId } };
    const branch: TemplateDetail = { ...template, id: branchDefinitionId,
      scope: { type: "BRANCH", companyId: nextCompanyId, branchId } };
    const branchDraft = { ...draft, templateId: branch.id, draftId: branch.id, revision: 9, etag: '"9"' };
    mocks.read.mockImplementation(async id => id === branch.id ? branchDraft : draft);
    const scope = { tenantWide: false, companyIds: [companyId, nextCompanyId], branchIds: [branchId] };
    route.user.permissionScopes["templates.read"] = scope;
    route.user.permissionScopes["templates.update"] = scope;
    const permissions = [...route.user.permissions];
    const companyReply = deferred<Response>();
    const branchReply = deferred<Response>();
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockImplementationOnce(() => companyReply.promise)
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockImplementationOnce(() => branchReply.promise);
    vi.stubGlobal("fetch", transport);
    const actual = await vi.importActual<typeof import("../../template-design-api")>("../../template-design-api");
    const acceptedByAdapter = vi.fn();
    mocks.save.mockImplementation(async (...args: Parameters<typeof actual.saveTemplateDraft>) => {
      const response = await actual.saveTemplateDraft(...args);
      acceptedByAdapter(response);
      return response;
    });

    const { result, rerender } = renderHook(({ value }: { value: TemplateDetail }) => useTemplateDesignEditor(value, true),
      { initialProps: { value: company } });
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    let companyRecover!: Promise<void>;
    act(() => { companyRecover = result.current.recover(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    const companyRequest = assertSameIntent(transport, 2);

    route.user.permissions = [];
    rerender({ value: branch });
    expect(result.current.draft).toBeNull();
    route.user.permissions = permissions;
    rerender({ value: branch });
    await waitFor(() => expect(result.current.draft?.etag).toBe('"9"'));
    expect(getStoredTenantSessionMeta()).toMatchObject({ sessionId: "session-a", authorizationVersion: 1 });
    expect(result.current.unknown).toBeNull();

    act(() => typeText(result.current, "Branch-only change"));
    await act(async () => { await result.current.save(); });
    const branchIntent = result.current.unknown;
    const newRequest = writes(transport)[2];
    expect(newRequest.key).toBe(branchIntent?.mutationId);
    expect(newRequest.key).not.toBe(companyRequest.key);
    expect(newRequest.url).toContain(draftPath(branch.id));
    let branchRecover!: Promise<void>;
    act(() => { branchRecover = result.current.recover(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(4));
    expect(writes(transport)[3]).toEqual(newRequest);
    const stored = () => Object.entries(sessionStorage).filter(([key]) => key.startsWith("sales-quotation:draft-save:"));
    const pending = stored();
    expect(pending).toHaveLength(2);

    const globalToast = vi.fn();
    const permissionDenial = vi.fn();
    const unsubscribe = subscribePermissionDenials(permissionDenial);
    window.addEventListener("global-toast", globalToast);
    try {
      await act(async () => {
        companyReply.resolve(status === 200 ? savedReply(draft, transport.mock.calls[1][1]) : wire(gateway.forbidden));
        await companyRecover;
      });
    } finally {
      unsubscribe();
      window.removeEventListener("global-toast", globalToast);
    }
    expect(acceptedByAdapter).not.toHaveBeenCalled();
    expect(result.current.draft).toMatchObject({ templateId: branch.id, revision: 9, etag: '"9"' });
    expect(result.current.unknown).toEqual(branchIntent);
    expect(result.current.saving).toBe(true);
    expect(stored()).toEqual(pending);
    expect([globalToast.mock.calls.length, permissionDenial.mock.calls.length]).toEqual([0, 0]);

    await act(async () => {
      branchReply.resolve(savedReply(branchDraft, transport.mock.calls[3][1]));
      await branchRecover;
    });
    expect(result.current.draft).toMatchObject({ templateId: branch.id, revision: 10, etag: '"10"' });
    expect(result.current.document?.nodes[textId].props.text).toBe("Branch-only change");
    expect(result.current.unknown).toBeNull();
    expect(stored()).toHaveLength(1);
    expect(stored()[0][1]).toContain(companyRequest.key!);
  });

  it.each([
    ["a contradictory in-flight envelope", () => errorReply(412, "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT", 409)],
    ["a contradictory stale envelope", () => errorReply(412, "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION", 409)],
    ["the exact pre-admission Gateway 403", () => wire(gateway.forbidden)],
  ] as const)("keeps an unresolved write after %s", async (_label, reply) => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(wire(gateway.timeout))
      .mockResolvedValueOnce(reply())
      .mockImplementationOnce(async (_url, init) => savedReply(draft, init));
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    const original = result.current.unknown;
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(original);
    expect(result.current.conflict).toBe(false);
    await act(async () => { await result.current.recover(); });
    assertSameIntent(transport, 3);
  });

  it("refuses a stale code from another request method as a draft receipt", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(errorReply(409, "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION"));
    vi.stubGlobal("fetch", transport);
    mocks.save.mockRejectedValueOnce(new Error("First reply lost"))
      .mockImplementationOnce(() => axiosClient.get(draftPath(ID)));
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    const original = result.current.unknown;
    await act(async () => { await result.current.recover(); });
    expect(result.current.unknown).toEqual(original);
    expect(result.current.conflict).toBe(false);
  });

  it("fences a retained edit and duplicate submit before React commits the busy state", async () => {
    const reply = deferred<Response>();
    const transport = vi.fn<typeof fetch>(() => reply.promise);
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    const authored = result.current.document;
    const saved = result.current.save;
    const edit = result.current.setNodeFlags;
    let pending!: Promise<void>;
    act(() => { pending = saved(); edit(textId, { hidden: false }); void saved(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    expect(result.current.document).toBe(authored);
    await act(async () => { reply.resolve(savedReply(draft, transport.mock.calls[0][1])); await pending; });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.current.draft?.revision).toBe(4);
  });

  it.each(["template", "scope"] as const)("ignores an older save after the %s changes", async change => {
    const other = "01890000-0000-7000-8000-000000000099";
    const otherTemplate: TemplateDetail = change === "scope"
      ? { ...template, scope: { type: "COMPANY", companyId: other } }
      : { ...template, id: other };
    const otherDraft = change === "scope" ? draft : { ...draft, templateId: other, draftId: other };
    mocks.read.mockResolvedValueOnce(draft).mockResolvedValueOnce(otherDraft);
    const oldReply = deferred<Response>();
    const newReply = deferred<Response>();
    const transport = vi.fn<typeof fetch>().mockImplementationOnce(() => oldReply.promise)
      .mockImplementationOnce(() => newReply.promise);
    vi.stubGlobal("fetch", transport);
    await realSave();
    const { result, rerender } = renderHook(({ value }) => useTemplateDesignEditor(value, true),
      { initialProps: { value: template } });
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    let oldFlight!: Promise<void>;
    act(() => { oldFlight = result.current.save(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    rerender({ value: otherTemplate });
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => hideText(result.current));
    let newFlight!: Promise<void>;
    act(() => { newFlight = result.current.save(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    await act(async () => { oldReply.resolve(savedReply(draft, transport.mock.calls[0][1])); await oldFlight; });
    expect(result.current.saving).toBe(true);
    expect(result.current.draft?.templateId).toBe(otherTemplate.id);
    expect(result.current.draft?.revision).toBe(3);
    await act(async () => { await result.current.save(); });
    expect(transport).toHaveBeenCalledTimes(2);
    await act(async () => { newReply.resolve(savedReply(otherDraft, transport.mock.calls[1][1])); await newFlight; });
    expect(result.current.saving).toBe(false);
    expect(result.current.draft?.revision).toBe(4);
  });

  describe("receipt contradictions carried into the workspace", () => {
    const other = "01890000-0000-7000-8000-000000000099";
    const staleReply = (patch: Record<string, unknown>) => Response.json({
      success: false, statusCode: 409, code: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION", ...patch,
    }, { status: 409 });
    it.each([
      ["success-marked stale reply", () => staleReply({ success: true })],
      ["stale instance for another template", () => staleReply({ instance: draftPath(other) })],
      ["browser-followed redirect to another template", () => {
        const response = staleReply({ instance: draftPath(other) });
        Object.defineProperties(response, {
          redirected: { value: true }, url: { value: "http://localhost" + draftPath(other) },
        });
        return response;
      }],
    ] as const)("keeps the original intent after a %s", async (_label, reply) => {
      const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(wire(gateway.timeout)).mockResolvedValueOnce(reply());
      vi.stubGlobal("fetch", transport);
      await realSave();
      const { result } = renderHook(() => useTemplateDesignEditor(template, true));
      await waitFor(() => expect(result.current.editable).toBe(true));
      act(() => hideText(result.current));
      await act(async () => { await result.current.save(); });
      const original = result.current.unknown;
      expect(original).not.toBeNull();
      await act(async () => { await result.current.recover(); });
      assertSameIntent(transport, 2);
      expect({ pending: result.current.unknown, conflict: result.current.conflict }).toEqual({
        pending: original, conflict: false,
      });
    });
  });

  it("loads the authorized draft before asking for schema or assets", async () => {
    let complete: (value: typeof draft) => void = () => {};
    mocks.read.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    expect(mocks.schema).not.toHaveBeenCalled();
    expect(mocks.assets).not.toHaveBeenCalled();
    await act(async () => complete(draft));
    await waitFor(() => expect(result.current.editable).toBe(true));
    expect(mocks.schema).toHaveBeenCalledWith(template.dataSourceKey, expect.objectContaining(template.scope), expect.any(AbortSignal));
  });

  it("preserves an authorized draft when schema is unavailable and reloads the dependency", async () => {
    mocks.schema.mockRejectedValueOnce({ status: 503 });
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.document).toEqual(document);
    expect(result.current.schema).toBeNull();
    expect(result.current.editable).toBe(false);
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(result.current.document).toEqual(document);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.editable).toBe(true));
  });

  it.each([[403, undefined, "denied"], [403, "ACCESS_POLICY_BLOCKED", "unavailable"], [404, undefined, "missing"]])(
    "keeps draft authority failure %s %s separate from dependency availability", async (status, code, state) => {
      mocks.read.mockRejectedValueOnce({ status, code });
      const { result } = renderHook(() => useTemplateDesignEditor(template, true));
      await waitFor(() => expect(result.current.loadFailure).toBe(state));
      expect(result.current.document).toBeNull();
      expect(mocks.schema).not.toHaveBeenCalled();
      expect(mocks.assets).not.toHaveBeenCalled();
    },
  );

  it("keeps a read-authorized draft viewable when write mode is restricted", async () => {
    const { result } = renderHook(() => useTemplateDesignEditor(template, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.document).toEqual(document);
    expect(result.current.editable).toBe(false);
    act(() => hideText(result.current));
    await act(async () => { await result.current.save(); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(result.current.document).toEqual(document);
  });

  it("clears the draft if the feature is authoritatively blocked during dependency load", async () => {
    mocks.schema.mockRejectedValueOnce({ status: 403, code: "ACCESS_POLICY_BLOCKED" });
    const { result } = renderHook(() => useTemplateDesignEditor(template, true));
    await waitFor(() => expect(result.current.loadFailure).toBe("unavailable"));
    expect(result.current.document).toBeNull();
  });
});

type EditorProbeProps = {
  template: TemplateDetail;
  canMutate: boolean;
  draftRefresh?: Parameters<typeof useTemplateDesignEditor>[3];
};

const route = vi.hoisted(() => ({
  authState: "AUTHENTICATED" as "AUTHENTICATED" | "STALE",
  editorProbe: null as ((props: EditorProbeProps) => ReactNode) | null,
  fetch: vi.fn(),
  readyProfile: vi.fn<() => unknown>(() => null),
  user: {
    id: "actor",
    permissions: ["templates.read", "templates.update", "templates.preview"],
    permissionScopes: {
      "templates.read": { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] },
      "templates.update": { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] },
    },
  },
  generation: "tenant:session-a:actor",
  mode: { isResolved: true, canRead: true, canMutate: true },
}));
vi.mock("../../templates-api", () => ({ fetchTemplate: route.fetch }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  user: route.user, authState: route.authState, isAuthenticated: true, isLoading: false, realtimeAuthGeneration: route.generation,
  readReadyProfileCommit: route.readyProfile, subscribeProfileReadiness: () => () => {},
}) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => route.mode }));
vi.mock("@/design-system", () => ({
  PermissionGate: ({ require, denied, children }: { require: string[]; denied: boolean; children: ReactNode }) =>
    denied || !require.every(permission => route.user.permissions.includes(permission)) ? "Denied" : children,
  Skeleton: () => "Loading",
  UnavailableState: () => "Policy unavailable",
  NotFoundState: () => "Missing",
  ErrorState: () => "Failed",
  Button: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/TemplateDesignEditor", () => ({
  TemplateDesignEditor: (props: EditorProbeProps) => {
    if (route.editorProbe) return createElement(route.editorProbe, props);
    return props.canMutate ? "Editor mounted" : "Read-only editor";
  },
}));

describe("canonical design workspace admission", () => {
  const definition = template;
  beforeEach(() => {
    route.fetch.mockReset();
    route.fetch.mockResolvedValue(definition);
    route.user.permissions = ["templates.read", "templates.update", "templates.preview"];
    route.user.permissionScopes["templates.read"] = { tenantWide: true, companyIds: [], branchIds: [] };
    route.user.permissionScopes["templates.update"] = { tenantWide: true, companyIds: [], branchIds: [] };
    route.generation = "session-a";
    route.mode = { isResolved: true, canRead: true, canMutate: true };
  });

  it("requests the exact definition for a deep link before mounting the editor", async () => {
    render(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(screen.queryByText("Editor mounted")).toBeNull();
    expect(await screen.findByText("Editor mounted")).toBeTruthy();
    expect(route.fetch).toHaveBeenCalledWith(ID, expect.any(AbortSignal));
  });

  it("keeps scoped authoring available when the advisory mode is unresolved", async () => {
    route.mode.isResolved = false;
    render(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(await screen.findByText("Editor mounted")).toBeTruthy();
  });

  it("denies the route before fetching without both session permissions", () => {
    route.user.permissions = ["templates.read"];
    render(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(screen.getByText("Denied")).toBeTruthy();
    expect(route.fetch).not.toHaveBeenCalled();
  });

  it("does not treat assignment branch access as definition ownership", async () => {
    const companyId = "01890000-0000-7000-8000-000000000002";
    route.fetch.mockResolvedValue({ ...definition, scope: { type: "COMPANY", companyId } });
    route.user.permissionScopes["templates.update"] = { tenantWide: false, companyIds: [], branchIds: [ID] };
    render(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(await screen.findByText("Denied")).toBeTruthy();
    expect(screen.queryByText("Editor mounted")).toBeNull();
  });

  it.each([[403, "ACCESS_POLICY_BLOCKED", "Policy unavailable"], [403, undefined, "Denied"], [404, undefined, "Missing"]])(
    "surfaces definition denial %s %s without mounting an editor", async (status, code, text) => {
      route.fetch.mockRejectedValue({ status, code });
      render(createElement(TemplateDesignWorkspace, { id: ID }));
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByText("Editor mounted")).toBeNull();
    },
  );

  it("hides previous editor state on session change", async () => {
    const view = render(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(await screen.findByText("Editor mounted")).toBeTruthy();
    route.fetch.mockReturnValue(new Promise(() => {}));
    route.generation = "session-b";
    view.rerender(createElement(TemplateDesignWorkspace, { id: ID }));
    expect(screen.queryByText("Editor mounted")).toBeNull();
    expect(screen.getByText("Loading")).toBeTruthy();
  });
});
