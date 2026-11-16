// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { TemplateDraftConflict, TemplateSnapshotReview, canReviewNewerDraft } from "./[id]/components/TemplateDraftRecoveryReview";
import { appendEditorNode } from "./template-editor-model";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTemplateDraft, saveTemplateDraft } from "./template-design-api";
import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { formatPage, updatePageSetup } from "./pages/page-commands";
import { readTemplateDraftReceipt } from "./template-draft-receipt";
import type { EditorDocument } from "./template-editor-model";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../core-api", () => {
  const rawResponse = (method: "GET" | "PATCH", call: typeof api.get) => async (...args: unknown[]) => ({
    status: 200, headers: new Headers(), provenance: "http",
    request: { endpoint: args[0], method, origin: window.location.origin, finalUrl: `${window.location.origin}${args[0]}`, redirected: false },
    ...await call(...args),
  });
  return { coreGet: api.get, coreGetResponse: rawResponse("GET", api.get), corePatchResponse: rawResponse("PATCH", api.patch) };
});

// Captured from Core's draft projection and save execution with synthetic persistence.
const document: EditorDocument = {
  "schemaVersion": 1,
  "documentType": "QUOTATION",
  "outputChannel": "PRINT",
  "layoutMode": "HYBRID_DOCUMENT",
  "dataSourceKey": "TRADE_QUOTATION_PRINT_V1",
  "locale": "en-US",
  "direction": "LTR",
  "page": {
    "unit": "MM",
    "preset": "A4",
    "widthMm": 210,
    "heightMm": 297,
    "orientation": "PORTRAIT",
    "marginMm": {
      "top": 10,
      "end": 10,
      "bottom": 10,
      "start": 10
    }
  },
  "theme": {
    "fontFamilyToken": "SYSTEM_SANS",
    "baseFontSizePx": 16,
    "textColor": "#111827",
    "accentColor": "#2563EB",
    "surfaceColor": "#FFFFFF",
    "lineHeight": 1.5
  },
  "rootNodeIds": [
    "01890000-0000-7000-8000-000000000004"
  ],
  "nodes": {
    "01890000-0000-7000-8000-000000000004": {
      "id": "01890000-0000-7000-8000-000000000004",
      "type": "container",
      "parentId": null,
      "childIds": [],
      "locked": false,
      "hidden": false,
      "layout": {
        "kind": "FLOW",
        "order": 0,
        "keepTogether": false,
        "breakBefore": false,
        "breakAfter": false
      },
      "style": {},
      "props": {
        "semanticRole": "BODY"
      }
    }
  }
};
const readDraft = {
  "draftId": "01890000-0000-7000-8000-000000000002",
  "templateId": "01890000-0000-7000-8000-000000000001",
  "schemaVersion": 1,
  "contentChecksum": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "baseVersionId": null,
  "restoreSourceVersionId": null,
  "validation": {
    "state": "PASSED",
    "lastValidationRunId": "01890000-0000-7000-8000-000000000004",
    "validatedDraftRevision": 4,
    "errorCount": 0,
    "warningCount": 0
  },
  "revision": 4,
  "etag": "\"4\"",
  "updatedAt": "2026-11-09T12:00:00.000Z",
  "updatedBy": {
    "kind": "USER",
    "actorId": "01890000-0000-7000-8000-000000000003",
    "displayName": "User"
  },
  editorDocument: document,
};
const savedDraft = {
  "draftId": "01890000-0000-7000-8000-000000000002",
  "templateId": "01890000-0000-7000-8000-000000000001",
  "schemaVersion": 1,
  "contentChecksum": "83ebc86f5b5bfef13d3528ea9cd056e45b5414d911273e2f1a359ce6952bc137",
  "baseVersionId": null,
  "restoreSourceVersionId": null,
  "validation": {
    "state": "STALE",
    "lastValidationRunId": null,
    "validatedDraftRevision": null,
    "errorCount": 0,
    "warningCount": 0
  },
  "revision": 5,
  "etag": "\"5\"",
  "updatedAt": "2026-11-09T20:29:59.532Z",
  "updatedBy": {
    "kind": "USER",
    "actorId": "01890000-0000-7000-8000-000000000003",
    "displayName": "User"
  },
  editorDocument: document,
};

const patchData = { draft: savedDraft, migrationRecovery: null };
const mutationId = "01890000-0000-7000-8000-000000000004";
const path = `/api/tenant/core/v1/templates/${readDraft.templateId}/draft`;
const originalRequest = { editorDocument: document, clientMutationId: mutationId };
const originalOptions = {
  headers: { "If-Match": readDraft.etag, "x-idempotency-key": mutationId },
  maxResponseBytes: 3_000_000,
  requireExactResponseTarget: true,
};
const save = () => saveTemplateDraft(readDraft.templateId, document, readDraft.etag, mutationId);

describe("coherent draft HTTP receipts before Core unwrap", () => {
  beforeEach(() => vi.resetAllMocks());
  // Test-owned Core handler DTO and shared interceptor envelope; no external artifact is required.
  const wire = {
    rawHandlerBody: patchData,
    wrappedBody: { success: true, data: patchData, correlationId: mutationId, timestamp: "2026-11-10T00:00:00.000Z" },
  };
  it.each([
    ["raw current handler", (): unknown => wire.rawHandlerBody],
    ["actual backend interceptor envelope", (): unknown => wire.wrappedBody],
    ["legacy data wrapper without discriminator", (): unknown => ({ data: wire.rawHandlerBody })],
    ["documented trace and replay metadata", (): unknown => ({ ...wire.wrappedBody as object,
      correlationId: mutationId, timestamp: "2026-11-10T00:00:00.000Z", meta: { trace: "opaque" } })],
    ["coherent optional HTTP aliases", (): unknown => ({ success: true, statusCode: 200, status: 200, data: wire.rawHandlerBody })],
  ] as const)("accepts %s without discarding the canonical acknowledgement", async (_label, body) => {
    api.patch.mockResolvedValue({ status: 200, headers: new Headers({ ETag: wire.rawHandlerBody.draft.etag, "idempotency-replayed": "true" }), data: body() });
    expect((await save()).revision).toBe(wire.rawHandlerBody.draft.revision);
    expect(api.patch).toHaveBeenCalledOnce();
  });

  it.each([
    ["false discriminator", { success: false }],
    ["null discriminator", { success: null }],
    ["string discriminator", { success: "true" }],
    ["numeric error status", { success: true, statusCode: 409 }],
    ["Problem Details status", { success: true, status: 409 }],
    ["malformed status alias", { success: true, statusCode: "200" }],
    ["stale error code", { success: true, errorCode: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION" }],
    ["Problem Details code", { success: true, code: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION" }],
    ["Problem Details body marker", { success: true, type: "https://errors.mutakamel.ai/example", title: "Error" }],
    ["wrong response path", { success: true, path: "/other/draft" }],
    ["wrong public instance", { success: true, instance: "/other/draft" }],
  ])("rejects contradictory outer %s despite a valid nested draft", async (_label, extra) => {
    api.patch.mockResolvedValue({ status: 200, headers: new Headers({ ETag: savedDraft.etag }), data: { ...extra, data: patchData } });
    await expect(save()).rejects.toThrow();
  });

  it.each([
    ["inner false discriminator", { success: false }],
    ["inner stale status", { statusCode: 409 }],
    ["inner error alias", { errorCode: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION" }],
    ["inner Problem Details marker", { errors: { draft: ["rejected"] } }],
  ])("rejects %s before canonical draft parsing", async (_label, extra) => {
    api.patch.mockResolvedValue({ status: 200, headers: new Headers(), data: { success: true, data: { ...patchData, ...extra } } });
    await expect(save()).rejects.toThrow();
  });

  it.each([201, 202, 204, 409])("does not accept an HTTP %s as the documented draft-save 200", async status => {
    api.patch.mockResolvedValue({ status, headers: new Headers(), data: { success: true, data: patchData } });
    await expect(save()).rejects.toThrow();
  });
  it.each(['"999"', 'W/"5"', '"5", "999"', ""])("rejects a supplied representation ETag %j that disagrees with the body", async etag => {
    api.patch.mockResolvedValue({ status: 200, headers: new Headers({ ETag: etag }), data: patchData });
    await expect(save()).rejects.toThrow();
  });
  it.each([{ draft: savedDraft }, { migrationRecovery: null }])("rejects a wrapped acknowledgement with an outer handler field %j", async outer => {
    api.patch.mockResolvedValue({ data: { ...outer, success: true, data: patchData } });
    await expect(save()).rejects.toThrow();
  });
});

describe("draft receipt authority", () => {
  const staleCode = "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION";
  const finalUrl = `${window.location.origin}${path}`;
  const coreConflict = {
    success: false, statusCode: 409, errorCode: staleCode, errorCategory: "CONFLICT",
    path: `/api/v1/templates/${readDraft.templateId}/draft`,
  };
  const problem = {
    status: 412, code: staleCode, instance: path,
    type: "https://errors.mutakamel.ai/core/template/concurrency/stale_revision",
  };
  const target = { method: "PATCH", endpoint: path, origin: window.location.origin, finalUrl, redirected: false };
  const receipt: Parameters<typeof readTemplateDraftReceipt>[0] = {
    status: 409, body: coreConflict, headers: new Headers(), provenance: "http", request: target,
  };
  const classify = (overrides: Partial<typeof receipt> = {}) =>
    readTemplateDraftReceipt({ ...receipt, ...overrides }, readDraft.templateId, { method: "PATCH" }).kind;

  it("confirms the Core stale response and the matching 412 problem response", () => {
    expect(classify()).toBe("stale");
    expect(classify({ status: 412, body: problem, request: { ...target, finalUrl: "" } })).toBe("stale");
  });

  it("requires corroborating route evidence and a consistent template for stale replies", () => {
    const body = { success: false, statusCode: 409, errorCode: staleCode };
    expect(classify({ body })).toBe("stale");
    expect(classify({ body, request: { ...target, finalUrl: "" } })).toBe("unconfirmed");
    expect(classify({ body: { ...coreConflict, templateId: mutationId } })).toBe("unconfirmed");
  });

  it("requires HTTP provenance and the exact draft PATCH target for a stale receipt", () => {
    expect(classify({ provenance: "client" })).toBe("unconfirmed");
    expect(classify({ request: { ...target, method: "GET" } })).toBe("unconfirmed");
    expect(classify({ request: { ...target, redirected: true } })).toBe("unconfirmed");
    for (const suffix of ["?", "#"]) {
      const request = { ...target, finalUrl: `${finalUrl}${suffix}` };
      expect(classify({ request })).toBe("unconfirmed");
      expect(classify({ request, status: 200, body: patchData })).toBe("unconfirmed");
    }
  });

  it("keeps a stale code unconfirmed when the error metadata or replay marker contradicts it", () => {
    expect(classify({ body: { ...coreConflict, errorCategory: "AUTHORIZATION" } })).toBe("unconfirmed");
    expect(classify({ body: { ...coreConflict, migrationRecovery: null } })).toBe("unconfirmed");
    expect(classify({ body: { ...readDraft, ...coreConflict } })).toBe("unconfirmed");
    expect(classify({ status: 412, body: { ...problem, type: "https://errors.mutakamel.ai/gw/auth/forbidden" } })).toBe("unconfirmed");
    expect(classify({ headers: new Headers({ "Idempotency-Replayed": "true" }) })).toBe("unconfirmed");
  });
});

describe("draft persistence contract", () => {
  beforeEach(() => vi.resetAllMocks());

  const load = (signal?: AbortSignal) => fetchTemplateDraft(readDraft.templateId, signal, document.dataSourceKey);
  const finalUrl = `${window.location.origin}${path}`;
  const getTarget = { endpoint: path, method: "GET", origin: window.location.origin, finalUrl, redirected: false };

  it.each([readDraft, { success: true, data: readDraft }])("reads the Sales Quotation draft and preserves the quoted revision", async data => {
    const signal = new AbortController().signal;
    api.get.mockResolvedValue({ data, headers: new Headers({ ETag: readDraft.etag }) });
    await expect(load(signal)).resolves.toEqual({
      draftId: readDraft.draftId,
      templateId: readDraft.templateId,
      editorDocument: document,
      revision: 4,
      etag: '"4"',
    });
    expect(api.get).toHaveBeenCalledWith(path, { signal, maxResponseBytes: 3_000_000, requireExactResponseTarget: true });
  });

  it.each([
    ["an outer failure marker", { data: { success: false, data: readDraft } }],
    ["conflicting inner status", { data: { data: { ...readDraft, statusCode: 409 } } }],
    ["conflicting outer draft fields", { data: { revision: 9, data: readDraft } }],
    ["conflicting inner path", { data: { data: { ...readDraft, path: "/other/draft" } } }],
    ["a missing HTTP 200", { status: 202 }],
    ["a redirect", { request: { ...getTarget, redirected: true } }],
    ["an unrelated final URL", { request: { ...getTarget, finalUrl: `${finalUrl}/other` } }],
    ["a PATCH transport result", { request: { ...getTarget, method: "PATCH" } }],
    ["a mismatched ETag header", { headers: new Headers({ ETag: '"3"' }) }],
    ["a mismatched body ETag", { data: { ...readDraft, etag: '"3"' } }],
    ["a replay marker", { headers: new Headers({ "Idempotency-Replayed": "true" }) }],
  ])("rejects %s before using a reloaded draft", async (_name, response) => {
    api.get.mockResolvedValue({ data: readDraft, ...response });
    await expect(load()).rejects.toThrow("Invalid Core identity response.");
  });

  const rootId = document.rootNodeIds[0];
  const titleId = "01890000-0000-7000-8000-000000000005";
  const fixed: EditorDocument = {
    ...document, layoutMode: "FIXED_CANVAS",
    nodes: {
      [rootId]: { ...document.nodes[rootId], childIds: [titleId] },
      [titleId]: {
        id: titleId, type: "text", parentId: rootId, childIds: [], hidden: false, locked: false,
        layout: { kind: "ABSOLUTE", unit: "MM", x: 10, y: 20, width: 120, height: 20, rotationDeg: 0, zIndex: 0 },
        style: {}, props: { text: "Sales quotation" },
      },
    },
  };
  const flow: EditorDocument = { ...document, layoutMode: "FLOW_DOCUMENT" };

  it.each([["hybrid", document], ["flow", flow], ["fixed", fixed]] as const)("preserves the %s document and sends the original revision and mutation key", async (_mode, editorDocument) => {
    api.patch.mockResolvedValue({
      data: { ...patchData, draft: { ...savedDraft, editorDocument } }, headers: new Headers({ ETag: '"5"' }),
    });
    await expect(saveTemplateDraft(readDraft.templateId, editorDocument, readDraft.etag, mutationId)).resolves.toEqual({
      draftId: savedDraft.draftId,
      templateId: savedDraft.templateId,
      editorDocument,
      revision: 5,
      etag: '"5"',
    });
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(path, { ...originalRequest, editorDocument }, originalOptions);
  });

  it.each([["hybrid", document], ["flow", flow], ["fixed", fixed]] as const)("rejects contradictory %s replay target evidence", async (_mode, editorDocument) => {
    const otherPath = path.replace(readDraft.templateId, mutationId);
    const finalUrl = `${window.location.origin}${path}`;
    const target = { endpoint: path, method: "PATCH", origin: window.location.origin, finalUrl, redirected: false };
    const draft = { ...savedDraft, editorDocument };
    const headers = new Headers({ ETag: draft.etag, "Idempotency-Replayed": "true" });
    api.patch.mockResolvedValueOnce({ data: { ...patchData, draft: { ...draft, path: otherPath } }, headers, request: { ...target, finalUrl: "" } })
      .mockResolvedValueOnce({ data: { ...patchData, draft }, headers, request: { ...target, redirected: true, finalUrl: `${window.location.origin}${otherPath}` } });
    const recover = () => saveTemplateDraft(readDraft.templateId, editorDocument, readDraft.etag, mutationId);
    await expect(recover()).rejects.toThrow("Invalid Core identity response.");
    await expect(recover()).rejects.toThrow("Invalid Core identity response.");
    expect(api.patch.mock.calls).toEqual(Array.from({ length: 2 }, () =>
      [path, { ...originalRequest, editorDocument }, originalOptions]));
  });

  it.each([
    ["a flat PATCH payload", savedDraft],
    ["a missing draft", { migrationRecovery: null }],
    ["a null draft", { ...patchData, draft: null }],
    ["a different template", { ...patchData, draft: { ...savedDraft, templateId: mutationId } }],
    ["a malformed nested document", { ...patchData, draft: { ...savedDraft, editorDocument: { ...document, nodes: {} } } }],
  ])("rejects %s", async (_name, data) => {
    api.patch.mockResolvedValue({ data });
    await expect(save()).rejects.toThrow("Invalid Core identity response.");
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { preset: "A4", widthMm: 210, heightMm: 297, label: "standard A4" },
    { preset: "A4", widthMm: 184.25, heightMm: 268.5, label: "A4 with stored overrides" },
    { preset: "CUSTOM", widthMm: 184.25, heightMm: 268.5, label: "custom size" },
  ] as const)("preserves both paper dimensions when rotating and reopening a Sales Quotation with $label", async ({ label: _label, ...size }) => {
    const initial = { ...document.page!, ...size };
    const editorDocument = { ...document, page: initial };
    expect(validateTemplateDocumentModel(editorDocument).valid).toBe(true);
    api.get.mockResolvedValueOnce({ data: { ...readDraft, editorDocument } });
    const loaded = await load();
    expect(loaded.editorDocument.page).toEqual(initial);

    api.patch.mockImplementationOnce((_path, request: { editorDocument: EditorDocument }) => {
      api.get.mockResolvedValueOnce({ data: { ...savedDraft, editorDocument: request.editorDocument } });
      return { data: { ...patchData, draft: { ...savedDraft, editorDocument: request.editorDocument } } };
    });
    const rotated = formatPage(loaded.editorDocument.page!, size.preset, "LANDSCAPE");
    const updated = updatePageSetup(loaded.editorDocument, rotated);
    await saveTemplateDraft(readDraft.templateId, updated, loaded.etag, mutationId);

    const reopened = await load();
    expect(reopened.revision).toBe(savedDraft.revision);
    expect(reopened.editorDocument.page).toEqual({
      ...initial, orientation: "LANDSCAPE", widthMm: initial.heightMm, heightMm: initial.widthMm,
    });
    expect(formatPage(reopened.editorDocument.page!, "A5", "LANDSCAPE")).toMatchObject({
      preset: "A5", widthMm: 210, heightMm: 148,
    });
  });
  it("keeps GET flat and rejects an unrelated template", async () => {
    api.get.mockResolvedValueOnce({ data: patchData })
      .mockResolvedValueOnce({ data: { ...readDraft, templateId: mutationId } });
    await expect(load()).rejects.toThrow("Invalid Core identity response.");
    await expect(load()).rejects.toThrow("Invalid Core identity response.");
  });

  it.each([
    ["numeric", readDraft.etag],
    ["descriptor", `"draft-schema:${"a".repeat(64)}:${readDraft.revision}"`],
  ] as const)("replays the exact successor with a %s tag after a reload reads a later revision", async (_tag, ifMatch) => {
    const attempt = () => saveTemplateDraft(readDraft.templateId, document, ifMatch, mutationId);
    const options = { ...originalOptions, headers: { ...originalOptions.headers, "If-Match": ifMatch } };
    const uncertain = new Error("Connection lost");
    api.get.mockResolvedValue({ data: { ...readDraft, revision: 6, etag: '"6"' }, headers: new Headers({ ETag: '"6"' }) });
    api.patch.mockRejectedValueOnce(uncertain).mockResolvedValueOnce({
      data: patchData,
      headers: new Headers({ ETag: '"5"', "Idempotency-Replayed": "true" }),
      status: 200,
    });
    await expect(attempt()).rejects.toBe(uncertain);
    expect(api.patch).toHaveBeenCalledTimes(1);
    await expect(load()).resolves.toMatchObject({ revision: 6, etag: '"6"' });
    await expect(attempt()).resolves.toMatchObject({ editorDocument: document, revision: 5, etag: '"5"' });
    expect(api.patch.mock.calls).toEqual([
      [path, originalRequest, options],
      [path, originalRequest, options],
    ]);
  });

  it.each([409, 412])("propagates an upstream %i precondition failure", async (status) => {
    const failure = { response: { status } };
    api.patch.mockRejectedValue(failure);
    await expect(save()).rejects.toBe(failure);
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(path, originalRequest, originalOptions);
  });
});

describe("read-only recovery side UI", () => {
  beforeEach(async () => {
    api.get.mockReset();
    api.patch.mockReset();
    await act(async () => { await setLanguage("en"); });
  });
  const provider = { initialLanguage: "en" } as Parameters<typeof I18nProvider>[0];

  it("focuses conflict, compares the exact newer saved draft and never offers a write in the dialog", async () => {
    const local = appendEditorNode({ ...document, direction: "RTL" }, "text", "Local edited note");
    const saved = appendEditorNode(document, "text", "Saved server note");
    api.get.mockResolvedValueOnce({ data: { ...savedDraft, editorDocument: saved } });
    render(createElement(I18nProvider, provider, createElement(TemplateDraftConflict, {
      base: readDraft, local, current: () => true, onReload: vi.fn(),
    })));
    const trigger = await screen.findByRole("button", { name: "Compare saved draft" });
    expect(globalThis.document.activeElement).toBe(screen.getByRole("alert"));
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Compare saved draft" });
    expect(await within(dialog).findByText("Saved server note")).toBeTruthy();
    expect(within(dialog).getByText("Local edited note")).toBeTruthy();
    expect(within(dialog).getByLabelText("Local draft").getAttribute("dir")).toBe("rtl");
    expect(within(dialog).getByLabelText("Saved draft").getAttribute("dir")).toBe("ltr");
    expect(within(dialog).queryByRole("button", { name: "Saved server note" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Local edited note" })).toBeNull();
    expect(api.get).toHaveBeenCalledWith(`/api/tenant/core/v1/templates/${readDraft.templateId}/draft`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(globalThis.document.activeElement).toBe(trigger));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("fails closed on another draft, a stale revision, or a mismatched ETag", () => {
    expect(canReviewNewerDraft(readDraft, savedDraft)).toBe(true);
    expect(canReviewNewerDraft(readDraft, readDraft)).toBe(false);
    expect(canReviewNewerDraft(readDraft, { ...savedDraft, draftId: readDraft.templateId })).toBe(false);
    expect(canReviewNewerDraft(readDraft, { ...savedDraft, etag: readDraft.etag })).toBe(false);
  });

  it("withholds a comparison response if authority changes during the GET", async () => {
    let active = true;
    let complete: (value: unknown) => void = () => {};
    api.get.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    render(createElement(I18nProvider, provider, createElement(TemplateDraftConflict, {
      base: readDraft, local: document, current: () => active, onReload: vi.fn(),
    })));
    fireEvent.click(await screen.findByRole("button", { name: "Compare saved draft" }));
    const dialog = await screen.findByRole("dialog", { name: "Compare saved draft" });
    active = false;
    await act(async () => { complete({ data: savedDraft }); });
    expect(await within(dialog).findByText("A newer saved draft is unavailable for comparison in this scope.")).toBeTruthy();
    expect(within(dialog).queryByRole("heading", { name: "Saved draft" })).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("uses only Core's recovery metadata endpoint and passes its cursor unchanged", async () => {
    const cursor = "signed.A+B/_=?";
    const snapshot = {
      snapshotId: readDraft.draftId, sourceDraftRevision: 4, snapshotChecksum: "a".repeat(64),
      captureReason: "SCHEMA_MIGRATION", createdAt: "2026-11-09T12:00:00.000Z",
      expiresAt: "2099-11-09T12:00:00.000Z", integrityStatus: "AVAILABLE",
      restoredAt: null, objectDeletedAt: null,
    };
    api.get.mockResolvedValueOnce({ data: { items: [snapshot], totalCount: 1, pageInfo: {
      limit: 25, nextCursor: cursor, hasNextPage: true,
    } } }).mockResolvedValueOnce({ data: { items: [], totalCount: 1, pageInfo: {
      limit: 25, nextCursor: null, hasNextPage: false,
    } } });
    render(createElement(I18nProvider, provider, createElement(TemplateSnapshotReview, {
      templateId: readDraft.templateId, current: () => true,
    })));
    fireEvent.click(await screen.findByRole("button", { name: "Inspect recovery snapshots" }));
    const dialog = await screen.findByRole("dialog", { name: "Inspect recovery snapshots" });
    expect(within(dialog).getByText("This list shows snapshot metadata. Snapshot content is unavailable here.")).toBeTruthy();
    expect(await within(dialog).findByText("Metadata")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /^Restore/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next page" }));
    const second = new URL(String(api.get.mock.calls[1][0]), "https://portal.example");
    expect(second.pathname).toBe(`/api/tenant/core/v1/templates/${readDraft.templateId}/draft/recovery-snapshots`);
    expect(second.searchParams.get("cursor")).toBe(cursor);
    expect(api.patch).not.toHaveBeenCalled();
  });
});
