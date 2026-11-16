// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen, waitFor, act, within } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson, validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { en } from "@/i18n/dictionaries/en";
import { templateFeedbackEn } from "@/i18n/dictionaries/template-feedback";
import { templateInspectorEn } from "@/i18n/dictionaries/template-inspector";
import { can } from "@/lib/auth/permission-scope";
import type { TemplateDetail } from "../../templates-contract";
import type { EditorDocument } from "../../template-editor-model";
import ownerFixture from "../../template-owner-admission-api.fixture.json";
import { pageCopies } from "../../pages/page-copy";
import { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import * as editorHooks from "../hooks/useTemplateDesignEditor";
import { TemplateDesignEditor } from "../components/TemplateDesignEditor";
import { TemplateDesignCanvas } from "../components/TemplateDesignCanvas";
import { TemplateDesignWorkspace } from "../design/TemplateDesignWorkspace";

const mocks = vi.hoisted(() => ({ definition: vi.fn(), read: vi.fn(), schema: vi.fn(), assets: vi.fn(),
  schemaThroughTransport: false, router: { push: vi.fn(), replace: vi.fn() } }));
const auth = vi.hoisted(() => ({
  authState: "AUTHENTICATED", isAuthenticated: true, isLoading: false,
  realtimeAuthGeneration: "tenant:session-a:01890000-0000-7000-8000-0000000000aa",
  user: { id: "01890000-0000-7000-8000-0000000000aa", permissions: ["templates.read", "templates.update"],
    permissionScopes: {
      "templates.read": { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] },
      "templates.update": { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] },
    }, accessibleBranchCompanies: [] as { companyId: string; branchId: string }[] },
  readReadyProfileCommit: vi.fn(() => null as unknown),
  subscribeProfileReadiness: () => () => {},
}));
const access = vi.hoisted(() => ({ isResolved: true, canRead: true, canMutate: true, useActual: false }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/hooks/useAccessMode", async original => {
  const actual = await original<typeof import("@/hooks/useAccessMode")>();
  return { useAccessMode() {
    const state = actual.useAccessMode();
    return access.useActual ? state : access;
  } };
});
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/core/templates" }));
vi.mock("../../templates-api", () => ({ fetchTemplate: mocks.definition }));
vi.mock("../../template-design-api", async original => {
  const actual = await original<typeof import("../../template-design-api")>();
  return { ...actual, fetchTemplateDraft: mocks.read,
    fetchTemplateDataSchema: (...args: Parameters<typeof actual.fetchTemplateDataSchema>) =>
      mocks.schemaThroughTransport ? actual.fetchTemplateDataSchema(...args) : mocks.schema(...args),
  };
});
vi.mock("../../template-assets-contract", async original => ({ ...await original<typeof import("../../template-assets-contract")>(), fetchTemplateAssets: mocks.assets }));

const id = "01890000-0000-7000-8000-000000000001";
const document: EditorDocument = { schemaVersion: 1, direction: "LTR", theme: {}, nodes: {}, rootNodeIds: [] };
const draft = { draftId: id, templateId: id, revision: 3, etag: '"3"', editorDocument: document };
const emailSource = {
  documentType: "CRM_OUTBOUND_EMAIL", outputChannel: "EMAIL", layoutMode: "EMAIL_FLOW",
  dataSourceKey: "CRM_LEAD_OUTBOUND_EMAIL_V1", locale: "en-US",
} as const;
const emailRoot = "01890000-0000-7000-8000-000000000020";
const emailText = (id: string, name: string, order: number) => ({
  id, name, type: "text", parentId: null, childIds: [], locked: false, hidden: false,
  layout: { kind: "FLOW", order }, style: {}, props: { text: name },
});
const emailDraft = { ...draft, editorDocument: {
  ...document, ...emailSource,
  theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 14, textColor: "#101B34", lineHeight: 1.5 },
  email: { maxWidthPx: 600, subject: { segments: [{ kind: "TEXT", value: "Draft recovery test" }] } },
  rootNodeIds: [emailRoot], nodes: { [emailRoot]: emailText(emailRoot, "First retained object", 0) },
} };
const checksum = (value: unknown) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const template = { id, name: "Stored definition", dataSourceKey: "TRADE_QUOTATION_PRINT_V1", documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT", scope: { type: "TENANT" }, locale: "en-US",
  currentDraft: { draftId: id, revision: 3, etag: '"3"', contentChecksum: checksum(document), validationState: "NOT_VALIDATED" },
} as TemplateDetail;
const emailTemplate: TemplateDetail = { ...template, ...emailSource, currentDraft: {
  draftId: id, revision: 3, etag: '"3"', contentChecksum: checksum(emailDraft.editorDocument), validationState: "NOT_VALIDATED",
} };
const labels = en.quotationPdf;

function assertValidEmail(value: unknown) {
  const result = validateTemplateDocumentModel(value);
  expect(result.issues).toEqual([]);
  expect(result.valid).toBe(true);
}

function mockEmailDraft(value: typeof draft = emailDraft) {
  assertValidEmail(value.editorDocument);
  const detail = { ...emailTemplate, currentDraft: {
    ...emailTemplate.currentDraft, contentChecksum: checksum(value.editorDocument),
  } };
  mocks.definition.mockResolvedValue(detail);
  mocks.read.mockImplementation(async () => structuredClone(value));
  return detail;
}

function observeMountedEditor() {
  return vi.spyOn(editorHooks, "useTemplateDesignEditor");
}

async function insertMountedEmailText(observer: ReturnType<typeof observeMountedEditor>) {
  await waitFor(() => expect(observer.mock.results.at(-1)?.value.editable).toBe(true));
  await act(async () => { observer.mock.results.at(-1)!.value.insertText(); });
  expect(screen.getByRole("button", { name: labels.saveDraft })).toBeEnabled();
}

beforeEach(() => {
  vi.resetAllMocks();
  setLanguage("en");
  sessionStorage.setItem("tenant_session_meta", JSON.stringify({ sessionId: "session-a", savedAt: Date.now(), expiresIn: 300, sessionExpiresIn: 300, tokenType: "Bearer", remember: false, authorizationVersion: 1, profileVersion: 1, authEventId: "composition" }));
  auth.user.permissions = ["templates.read", "templates.update"];
  auth.user.permissionScopes["templates.read"] = { tenantWide: true, companyIds: [], branchIds: [] };
  auth.user.permissionScopes["templates.update"] = { tenantWide: true, companyIds: [], branchIds: [] };
  auth.user.accessibleBranchCompanies = [];
  Object.assign(access, { isResolved: true, canRead: true, canMutate: true, useActual: false });
  mocks.schemaThroughTransport = false;
  mocks.definition.mockResolvedValue(template);
  mocks.read.mockImplementation(async () => JSON.parse(JSON.stringify(draft)));
  mocks.schema.mockResolvedValue({ fields: [], syntheticFixtures: [] });
  mocks.assets.mockResolvedValue({ items: [] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe("real workspace editor hook assembly", () => {
  it("keeps the refreshed save unresolved and asks before continuing from the saved draft", async () => {
    const editorDocument = { ...document, dataSourceKey: template.dataSourceKey, documentType: template.documentType,
      outputChannel: template.outputChannel, layoutMode: template.layoutMode, locale: template.locale };
    mocks.read.mockResolvedValue({ ...draft, editorDocument });
    const transport = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Reply lost"));
    vi.stubGlobal("fetch", transport);
    const observer = observeMountedEditor();
    const workspace = () => createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }));
    const first = render(workspace());
    await waitFor(() => expect(observer.mock.results.at(-1)?.value.editable).toBe(true));
    act(() => { observer.mock.results.at(-1)!.value.change({ ...editorDocument, direction: "RTL" }); });
    fireEvent.click(screen.getByRole("button", { name: labels.saveDraft }));
    await screen.findByRole("button", { name: labels.draftRecovery.recover });
    first.unmount();
    render(workspace());
    const check = await screen.findByRole("button", { name: labels.draftRecovery.checkSave });
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    fireEvent.click(check);
    expect(await screen.findByText(labels.draftRecovery.checkUnconfirmed)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: labels.draftRecovery.useSavedDraft }));
    const confirm = await screen.findByRole("alertdialog", { name: labels.draftRecovery.useSavedDraft });
    fireEvent.click(within(confirm).getByRole("button", { name: labels.cancel }));
    expect(await screen.findByRole("button", { name: labels.draftRecovery.checkSave })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: labels.draftRecovery.useSavedDraft }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: labels.draftRecovery.useSavedDraft }));
    await waitFor(() => expect(screen.queryByRole("button", { name: labels.draftRecovery.checkSave })).toBeNull());
    await waitFor(() => expect(observer.mock.results.at(-1)?.value.draft?.revision).toBe(3));
    expect(transport).toHaveBeenCalledOnce();
  });

  it("loads the stored definition and uses separate Save/Recover controls through real Axios", async () => {
    mockEmailDraft();
    const observer = observeMountedEditor();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ code: "GW.TIMEOUT" }, { status: 504 }))
      .mockImplementationOnce(async (_url, init) => Response.json({ success: true, data: { draft: {
        ...draft, revision: 4, etag: '"4"', editorDocument: JSON.parse(String(init?.body)).editorDocument,
      } } }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });
    expect(mocks.definition).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(mocks.read).toHaveBeenCalledTimes(1);
    await insertMountedEmailText(observer);
    fireEvent.click(screen.getByRole("button", { name: labels.saveDraft }));
    const recover = await screen.findByRole("button", { name: labels.draftRecovery.recover });
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    expect(observer.mock.results.at(-1)?.value.hasPending).toBe(true);
    fireEvent.click(recover);
    await waitFor(() => expect(screen.queryByRole("button", { name: labels.draftRecovery.recover })).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map(([url, init]) => ({ url, body: String(init?.body), etag: new Headers(init?.headers).get("if-match"), key: new Headers(init?.headers).get("x-idempotency-key") }));
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[0].etag).toBe('"3"');
    assertValidEmail(JSON.parse(requests[0].body).editorDocument);
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
  });

  it("honors known read-only policy and keeps scoped authoring available when the advisory mode is absent", async () => {
    mockEmailDraft();
    const observer = observeMountedEditor();
    const profileWithoutMode = auth.user;
    const readOnlyProfile = { ...profileWithoutMode, accessMode: "READ_ONLY" };
    auth.user = readOnlyProfile;
    access.useActual = true;
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const workspace = () => createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }));
    const view = await act(async () => render(workspace()));
    expect(await screen.findByText("First retained object")).toBeVisible();
    expect(screen.getByText(templateFeedbackEn.readOnly)).toBeVisible();
    expect(screen.queryByText(en.coreBilling.accessReadOnlyNotice)).toBeNull();
    expect(screen.queryByRole("button", { name: "First retained object" })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: labels.designer.insert }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("button", { name: labels.text })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    const policyEditor = observer.mock.results.at(-1)!.value;
    expect(policyEditor.flowRootInsertionAvailable).toBe(true);
    expect(policyEditor.editable).toBe(false);
    await act(async () => { policyEditor.insertText(); await policyEditor.save(); });
    expect(observer.mock.results.at(-1)!.value.document?.rootNodeIds).toEqual([emailRoot]);

    // The ordinary profile omits this advisory field. Core still authorizes Save.
    auth.user = profileWithoutMode;
    await act(async () => { view.rerender(workspace()); });
    expect(screen.queryByText(templateFeedbackEn.readOnly)).toBeNull();
    await insertMountedEmailText(observer);
    expect(mocks.read).toHaveBeenCalledTimes(1);

    // Core's draft read also requires the exact scoped update grant.
    auth.user.permissionScopes["templates.update"] = { tenantWide: false, companyIds: [], branchIds: [] };
    await act(async () => { view.rerender(workspace()); });
    expect(screen.queryByText("First retained object")).toBeNull();
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an unavailable data dependency explicit without permitting Save", async () => {
    mockEmailDraft();
    const observer = observeMountedEditor();
    mocks.schemaThroughTransport = true;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: "GW.UPSTREAM.BUSY" }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });
    expect(await screen.findByText(labels.schemaUnavailable)).toBeVisible();
    expect(await screen.findByText("First retained object")).toBeVisible();
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: labels.designer.insert }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("button", { name: labels.text })).toBeDisabled();
    const editor = observer.mock.results.at(-1)!.value;
    expect(editor.flowRootInsertionAvailable).toBe(true);
    expect(editor.editable).toBe(false);
    await act(async () => { editor.insertText(); await editor.save(); });
    expect(observer.mock.results.at(-1)!.value.document?.rootNodeIds).toEqual([emailRoot]);
    expect(fetchMock).toHaveBeenCalled();
    for (const [input, init] of fetchMock.mock.calls) {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe("/api/tenant/core/v1/templates/data-sources/CRM_LEAD_OUTBOUND_EMAIL_V1/schema");
      expect(url.searchParams.get("scopeType")).toBe("TENANT");
      expect(init?.method).toBe("GET");
    }
  });
});

describe("canonical hook exact branch caller contract", () => {
  it.each([true, false])("checks both read/update grants for the exact branch, permitted=%s", async permitted => {
    mockEmailDraft();
    const companyId = "01890000-0000-7000-8000-0000000000bb";
    const branchId = "01890000-0000-7000-8000-0000000000cc";
    const target = { companyId, branchId: permitted ? branchId : "01890000-0000-7000-8000-0000000000dd" };
    for (const key of ["templates.read", "templates.update"] as const) auth.user.permissionScopes[key] = { tenantWide: false, companyIds: [], branchIds: [branchId] };
    auth.user.accessibleBranchCompanies = [{ companyId, branchId }];
    expect(can(auth.user, "templates.update", target)).toBe(permitted);
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => Response.json({ success: true, data: { draft: {
      ...draft, revision: 4, etag: '"4"', editorDocument: JSON.parse(String(init?.body)).editorDocument,
    } } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTemplateDesignEditor({ ...emailTemplate, scope: { type: "BRANCH", ...target } }, true), { wrapper: I18nProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.insertText());
    await act(async () => { await result.current.save(); });
    expect(fetchMock).toHaveBeenCalledTimes(permitted ? 1 : 0);
    expect(result.current.editable).toBe(permitted);
    expect(result.current.draft?.revision).toBe(permitted ? 4 : undefined);
  });
});


describe("canonical gesture and private document ownership", () => {
  const transport = () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => Response.json({ success: true, data: { draft: {
      ...draft, revision: 4, etag: '\"4\"', editorDocument: JSON.parse(String(init?.body)).editorDocument,
    } } }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const open = async (canMutate = true) => {
    mockEmailDraft();
    const hook = renderHook(({ writable }) => useTemplateDesignEditor(emailTemplate, writable), { initialProps: { writable: canMutate }, wrapper: I18nProvider });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  };
  it("saves only a committed gesture and undoes its multiple authored changes together", async () => {
    const fetchMock = transport(), { result } = await open();
    act(() => result.current.beginGesture());
    act(() => result.current.insertText());
    act(() => result.current.insertDivider());
    expect(result.current.gestureActive).toBe(true);
    await act(async () => { await result.current.save(); });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.commitGesture());
    expect(result.current.nodes).toHaveLength(3);
    act(() => result.current.undo());
    expect(result.current.document?.rootNodeIds).toEqual([emailRoot]);
    expect(result.current.dirty).toBe(false);
    act(() => result.current.redo());
    await act(async () => { await result.current.save(); });
    expect(fetchMock).toHaveBeenCalledOnce();
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument;
    expect(saved.rootNodeIds).toHaveLength(3);
    assertValidEmail(saved);
    expect(result.current.draft?.revision).toBe(4);
    expect(result.current.dirty).toBe(false);
  });
  it("cancels an authored gesture and cancels it when write policy is lost", async () => {
    const fetchMock = transport(), { result, rerender } = await open();
    act(() => result.current.beginGesture());
    act(() => result.current.insertText());
    expect(result.current.document?.rootNodeIds).toHaveLength(2);
    expect(result.current.nodes.find(node => node.id !== emailRoot)?.props.text).toBe(labels.text);
    act(() => result.current.cancelGesture());
    expect(result.current.document?.rootNodeIds).toEqual([emailRoot]);
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.beginGesture());
    act(() => result.current.insertText());
    expect(result.current.document?.rootNodeIds).toHaveLength(2);
    expect(result.current.nodes.find(node => node.id !== emailRoot)?.props.text).toBe(labels.text);
    rerender({ writable: false });
    expect(result.current.gestureActive).toBe(false);
    expect(result.current.document?.rootNodeIds).toEqual([emailRoot]);
    expect(result.current.dirty).toBe(false);
    await act(async () => { await result.current.save(); });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps view changes out of dirty history and out of the saved authored document", async () => {
    const fetchMock = transport(), { result } = await open();
    act(() => result.current.setViewport({ zoom: 0.5, panX: 120, panY: -24, hand: true }));
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
    await act(async () => { await result.current.save(); });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.insertText());
    await act(async () => { await result.current.save(); });
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument;
    expect(saved).not.toHaveProperty("zoom");
    expect(saved).not.toHaveProperty("panX");
    expect(saved).not.toHaveProperty("selectedId");
  });
  it("does not let a rendering alias alter the private save body or baseline", async () => {
    const fetchMock = transport(), { result } = await open();
    act(() => result.current.insertText());
    const publicDocument = result.current.document!, node = publicDocument.rootNodeIds.at(-1)!;
    publicDocument.nodes[node].props.text = "tampered outside a command";
    publicDocument.theme.external = true;
    act(() => result.current.insertDivider());
    await act(async () => { await result.current.save(); });
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument;
    expect(saved.nodes[node].props.text).toBe(labels.text);
    expect(saved.theme).not.toHaveProperty("external");
    expect(result.current.document?.nodes[node].props.text).toBe(labels.text);
  });
  it("keeps invalid stored Fixed geometry unavailable", async () => {
    await import("../components/adapters/FixedDocumentAdapter");
    mocks.definition.mockResolvedValue({ ...template, layoutMode: "FIXED_CANVAS" });
    mocks.read.mockResolvedValue({ ...draft, editorDocument: { ...document, layoutMode: "FIXED_CANVAS" } });
    const fetchMock = transport();
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });
    expect(await screen.findByText(labels.designer.nativeUnavailable)).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: labels.designer.insert }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("button", { name: labels.text })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["en-US", "ar-EG"] as const)("opens and saves an existing Fixed quotation for %s", async locale => {
    await import("../components/adapters/FixedDocumentAdapter");
    const bodyId = "01890000-0000-7000-8000-000000000002";
    const textId = "01890000-0000-7000-8000-000000000003";
    const fixedTemplate = { ...template, layoutMode: "FIXED_CANVAS" as const, locale };
    const editorDocument: EditorDocument = {
      ...document, documentType: fixedTemplate.documentType, outputChannel: fixedTemplate.outputChannel,
      layoutMode: fixedTemplate.layoutMode, dataSourceKey: fixedTemplate.dataSourceKey, locale, direction: "AUTO",
      page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
        marginMm: { top: 12, end: 14, bottom: 12, start: 10 } },
      theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", accentColor: "#2563EB",
        surfaceColor: "#FFFFFF", lineHeight: 1.5 },
      rootNodeIds: [bodyId], nodes: {
        [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], hidden: false, locked: false,
          layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
        [textId]: { id: textId, type: "text", name: "Quotation title", parentId: bodyId, childIds: [], hidden: false, locked: false,
          layout: { kind: "ABSOLUTE", unit: "MM", x: 10, y: 20, width: 120, height: 20, rotationDeg: 0, zIndex: 0 },
          style: {}, props: { text: "Sales quotation" } },
      },
    };
    expect(validateTemplateDocumentModel(editorDocument).valid).toBe(true);
    mocks.definition.mockResolvedValue(fixedTemplate);
    mocks.read.mockResolvedValue({ ...draft, editorDocument });
    const fetchMock = transport();
    const first = render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id })));
    const object = await screen.findByRole("button", { name: "Quotation title" });
    expect(object).toHaveAttribute("dir", locale === "ar-EG" ? "rtl" : "ltr");
    expect(object.parentElement).toHaveAttribute("dir", locale === "ar-EG" ? "rtl" : "ltr");
    expect(object.parentElement).toHaveStyle({ insetInlineStart: "10mm", insetBlockStart: "20mm", inlineSize: "120mm" });
    expect(object.parentElement?.parentElement?.parentElement).toHaveStyle({ insetInlineStart: "10mm" });
    fireEvent.click(object);
    expect(object).toHaveAttribute("aria-pressed", "true");
    object.focus();
    fireEvent.keyDown(object, { key: "Escape" });
    expect(object).toHaveAttribute("aria-pressed", "false");
    expect(object).toHaveFocus();
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    fireEvent.click(object);
    fireEvent.change(screen.getByRole("textbox", { name: labels.text }), { target: { value: "Updated quotation" } });
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: labels.saveDraft }));
    await waitFor(() => expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument as EditorDocument;
    expect(saved).toEqual({ ...editorDocument, nodes: {
      ...editorDocument.nodes, [textId]: { ...editorDocument.nodes[textId], props: { text: "Updated quotation" } },
    } });
    first.unmount();
    mocks.read.mockResolvedValue({ ...draft, revision: 4, etag: '"4"', editorDocument: saved });
    render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id })));
    expect(await screen.findByRole("button", { name: "Quotation title" })).toHaveTextContent("Updated quotation");
  });
  it("permits keyboard hand navigation while a stored draft is read only", async () => {
    mockEmailDraft();
    access.canMutate = false;
    const fetchMock = transport();
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });
    const canvas = await screen.findByLabelText(labels.designer.canvas);
    fireEvent.click(screen.getByRole("button", { name: labels.designer.hand }));
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    expect(canvas.firstElementChild).toHaveStyle({ transform: "translate(24px, 0px) scale(1)" });
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(screen.getByRole("button", { name: labels.designer.hand })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it("refuses an unsafe Print root insert without dirtying or sending a save", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useTemplateDesignEditor(template, true), { wrapper: I18nProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const before = structuredClone(result.current.document);
  expect(result.current.editable).toBe(true);
  act(() => {
    result.current.insertText();
    result.current.insertDivider();
  });
  expect(result.current.document).toEqual(before);
  expect(result.current.dirty).toBe(false);
  expect(result.current.canUndo).toBe(false);
  await act(async () => { await result.current.save(); });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["HYBRID_DOCUMENT", "FLOW_DOCUMENT"] as const)(
  "inserts text, dividers and an available image into the selected sales quotation body in %s",
  async layoutMode => {
    const bodyId = "01890000-0000-7000-8000-000000000009";
    const imageId = "01890000-0000-7000-8000-00000000000a";
    const quotation = { ...template, layoutMode };
    const editorDocument: EditorDocument = {
      ...document, documentType: quotation.documentType, outputChannel: quotation.outputChannel,
      layoutMode, dataSourceKey: quotation.dataSourceKey, locale: quotation.locale,
      page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
        marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
      theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827",
        accentColor: "#2563EB", surfaceColor: "#FFFFFF", lineHeight: 1.5 },
      rootNodeIds: [bodyId], nodes: {
        [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [], hidden: false, locked: false,
          layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      },
    };
    mocks.read.mockResolvedValue({ ...draft, editorDocument });
    mocks.assets.mockResolvedValue({ items: [{ id: imageId, originalFileName: "quotation-logo.png",
      definitionId: null, status: "ACTIVE" }] });
    const { result } = renderHook(() => useTemplateDesignEditor(quotation, true), { wrapper: I18nProvider });
    await waitFor(() => expect(result.current.editable).toBe(true));
    act(() => result.current.select(bodyId));
    expect(result.current.scopedTextInsertionAvailable).toBe(true);
    expect(result.current.bindingPaletteAvailable).toBe(false);
    const insert = result.current.insertText;
    act(insert);
    const after = result.current.document!;
    const [childId] = after.nodes[bodyId].childIds;
    expect(after.nodes[childId]).toMatchObject({ parentId: bodyId, type: "text", props: { text: labels.text } });
    expect(after.rootNodeIds).toEqual([bodyId]);
    expect(result.current.dirty).toBe(true);
    act(insert);
    expect(result.current.document).toBe(after);
    act(() => result.current.select(childId));
    expect(result.current.editableQuotationText?.id).toBe(childId);
    const updateText = result.current.updateQuotationText;
    act(() => updateText("Quotation terms"));
    expect(result.current.document?.nodes[childId].props.text).toBe("Quotation terms");
    act(() => result.current.select(bodyId));
    act(() => updateText("Stale write"));
    expect(result.current.document?.nodes[childId].props.text).toBe("Quotation terms");
    expect(result.current.unboundBodyInsertionAvailable).toBe(true);
    act(result.current.insertDivider);
    const withDivider = result.current.document!;
    const [, dividerId] = withDivider.nodes[bodyId].childIds;
    expect(withDivider.nodes[dividerId]).toMatchObject({ parentId: bodyId, type: "divider", layout: { kind: "FLOW", order: 1 } });
    act(() => result.current.insertImage(bodyId));
    expect(result.current.document).toBe(withDivider);
    act(() => result.current.insertImage(imageId));
    const withImage = result.current.document!;
    const [, , imageNodeId] = withImage.nodes[bodyId].childIds;
    expect(withImage.nodes[imageNodeId]).toMatchObject({ parentId: bodyId, type: "image",
      props: { assetId: imageId, alt: "quotation-logo.png", decorative: false } });
    expect(validateTemplateDocumentModel(withImage).valid).toBe(true);
    render(createElement(TemplateDesignCanvas, { document: withImage, assets: result.current.assets, label: "Design canvas" }));
    const image = screen.getByRole("img", { name: "quotation-logo.png" });
    expect(new URL(image.getAttribute("src")!, window.location.origin).pathname)
      .toBe(`/api/tenant/core/v1/templates/assets/${imageId}/content`);
    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: "quotation-logo.png" })).toBeNull();
    act(() => result.current.select(imageNodeId));
    expect(result.current.canMoveUpWithinBody).toBe(true);
    expect(result.current.canMoveDownWithinBody).toBe(false);
    act(() => result.current.moveWithinBody(-1));
    expect(result.current.document?.nodes[bodyId].childIds).toEqual([childId, imageNodeId, dividerId]);
    act(result.current.undo);
    expect(result.current.document?.nodes[bodyId].childIds).toEqual([childId, dividerId, imageNodeId]);
  },
);

it("does not reload an equal inline definition object after a view or parent render", async () => {
  const hook = renderHook(() => useTemplateDesignEditor({ ...template, scope: { ...template.scope } }, true), { wrapper: I18nProvider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => hook.result.current.setViewport({ panX: 24 }));
  hook.rerender();
  expect(hook.result.current.loading).toBe(false);
  expect(mocks.read).toHaveBeenCalledOnce();
  expect(hook.result.current.viewport.panX).toBe(24);
});

it("inserts ordinary Sales fields and ordered line tables, then retires a previous company offer", async () => {
  const bodyId = "01890000-0000-7000-8000-000000000025";
  const companyId = "01890000-0000-7000-8000-000000000026";
  const nextCompanyId = "01890000-0000-7000-8000-000000000027";
  const scopedTemplate: TemplateDetail = {
    ...template, code: "SALES_QUOTATION_BINDING", description: null, direction: "LTR", lifecycleStatus: "ACTIVE",
    systemProtected: false, definitionRevision: 1, definitionEtag: '"1"', etag: '"1"',
    scope: { type: "COMPANY", companyId },
  };
  const editorDocument: EditorDocument = {
    ...document, documentType: scopedTemplate.documentType, outputChannel: scopedTemplate.outputChannel,
    layoutMode: scopedTemplate.layoutMode, dataSourceKey: scopedTemplate.dataSourceKey, locale: scopedTemplate.locale,
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", lineHeight: 1.5 },
    rootNodeIds: [bodyId],
    nodes: { [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [], locked: false, hidden: false,
      layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } } },
  };
  const checkedDraft = { ...draft, editorDocument };
  const schema = ownerFixture.rows.find(row => row.adapterKey === scopedTemplate.dataSourceKey)!;
  const definition = {
    ...scopedTemplate, templateId: id, revision: 1, currentPublishedVersion: null,
    currentDraft: { ...scopedTemplate.currentDraft, contentChecksum: checksum(editorDocument) },
    createdAt: "2026-11-13T12:00:00.000Z", updatedAt: "2026-11-13T12:00:00.000Z",
  };
  auth.readReadyProfileCommit.mockReturnValue({ user: auth.user, sessionRevision: '["session-a",1,1]', sequence: 1 });
  mocks.read.mockResolvedValue(checkedDraft);
  const definitionPath = "/api/tenant/core/v1/templates/" + id;
  const schemaPath = "/api/tenant/core/v1/templates/data-sources/" + scopedTemplate.dataSourceKey + "/schema?";
  let currentCompany = companyId;
  const requests = new Set<string>();
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const endpoint = String(input);
    requests.add(endpoint);
    expect(init).toMatchObject({ credentials: "include", redirect: "error", method: "GET" });
    const payload = endpoint === "/api/tenant/core/v1/auth/me" ? auth.user :
      endpoint === definitionPath ? { ...definition, scope: { type: "COMPANY", companyId: currentCompany } } :
      endpoint === definitionPath + "/draft" ? checkedDraft :
      endpoint === schemaPath + "scopeType=COMPANY&schemaVersion=1&companyId=" + currentCompany ? schema : undefined;
    expect(payload).toBeDefined();
    const response = Response.json({ success: true, data: payload }, { status: 200 });
    Object.defineProperties(response, { url: { value: window.location.origin + endpoint }, redirected: { value: false } });
    return response;
  }));
  const { result, rerender } = renderHook(({ detail }) => useTemplateDesignEditor(detail, true), {
    initialProps: { detail: scopedTemplate }, wrapper: I18nProvider,
  });
  await waitFor(() => expect(result.current.editable).toBe(true));
  act(() => result.current.select(bodyId));
  await waitFor(() => expect(result.current.salesBinding.offer?.fields).toContain("quotation.number"));
  expect(requests).toContain("/api/tenant/core/v1/auth/me");
  expect(requests).toContain(schemaPath + "scopeType=COMPANY&schemaVersion=1&companyId=" + companyId);
  const first = result.current.salesBinding.offer!;
  act(() => expect(result.current.salesBinding.insertField(first.pin, "quotation.number")).toBe(true));
  const choice = {
    offerPin: result.current.salesBinding.offer!.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey",
    columnPaths: ["unitPrice", "name"],
  };
  const staleInsert = result.current.salesBinding.insertTable;
  act(() => expect(staleInsert(choice)).toBe(true));
  const withTable = result.current.document!;
  const [fieldId, tableId] = withTable.nodes[bodyId].childIds;
  expect(withTable.nodes[fieldId]).toMatchObject({ type: "dataField", binding: { path: "quotation.number" } });
  expect(withTable.nodes[tableId]).toMatchObject({ type: "dynamicTable", props: {
    rowKeyPath: "rowKey", columns: [{ value: { binding: { path: "unitPrice" } } }, { value: { binding: { path: "name" } } }],
  } });
  act(() => result.current.select(tableId));
  const headers = result.current.salesBinding.offer!;
  const values = headers.tableHeaders!.columns.map((column, index) => ({
    id: column.id, label: ["Unit price", "الخدمة"][index],
  }));
  act(() => expect(result.current.salesBinding.updateTableHeaders(headers.pin, values)).toBe(true));
  expect(result.current.document?.nodes[tableId].props.columns).toMatchObject([
    { header: { kind: "TEXT", value: "Unit price" }, value: { binding: { path: "unitPrice" } } },
    { header: { kind: "TEXT", value: "الخدمة" }, value: { binding: { path: "name" } } },
  ]);
  act(result.current.undo);
  expect(result.current.document).toEqual(withTable);
  act(result.current.undo);
  expect(result.current.document?.nodes[bodyId].childIds).toEqual([fieldId]);
  currentCompany = nextCompanyId;
  rerender({ detail: { ...scopedTemplate, scope: { type: "COMPANY", companyId: nextCompanyId } } });
  expect(result.current.salesBinding.offer).toBeNull();
  act(() => expect(staleInsert(choice)).toBe(false));
  await waitFor(() => expect(result.current.editable).toBe(true));
  act(() => result.current.select(bodyId));
  await waitFor(() => expect(result.current.salesBinding.offer).not.toBeNull());
  expect(result.current.salesBinding.offer?.pin).not.toBe(choice.offerPin);
  expect(result.current.document?.nodes[bodyId].childIds).toEqual([]);
});

it("groups actual Properties input changes into one undo transaction", async () => {
  const nodeId = "01890000-0000-7000-8000-000000000008";
  const bodyId = "01890000-0000-7000-8000-00000000000b";
  const editorDocument: EditorDocument = {
    ...document, documentType: template.documentType, outputChannel: template.outputChannel,
    layoutMode: template.layoutMode, dataSourceKey: template.dataSourceKey, locale: template.locale,
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827",
      accentColor: "#2563EB", surfaceColor: "#FFFFFF", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: {
      [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [nodeId], hidden: false, locked: false,
        layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      [nodeId]: { id: nodeId, type: "text", parentId: bodyId, childIds: [], locked: false, hidden: false,
        layout: { kind: "FLOW", order: 0 }, style: {}, props: { text: "Stored text" } },
    },
  };
  expect(validateTemplateDocumentModel(editorDocument).valid).toBe(true);
  mocks.definition.mockResolvedValue({ ...template, currentDraft: { ...template.currentDraft, contentChecksum: checksum(editorDocument) } });
  mocks.read.mockResolvedValue({ ...draft, editorDocument });
  const copy = templateInspectorEn;
  render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id })));
  fireEvent.click(await screen.findByRole("button", { name: "Stored text" }));
  const save = screen.getByRole("button", { name: labels.saveDraft });
  fireEvent.click(screen.getByRole("button", { name: copy.title }));
  const field = await screen.findByLabelText(copy.name);
  fireEvent.change(field, { target: { value: "First" } });
  fireEvent.change(field, { target: { value: "Final name" } });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: copy.apply }));
  expect(await screen.findByText(copy.applied)).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: labels.undo }));
  expect(screen.getByRole("button", { name: labels.undo })).toBeDisabled();
  expect(screen.getByRole("button", { name: labels.redo })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: copy.title }));
  expect(await screen.findByLabelText(copy.name)).toHaveValue("");
});

it.each([
  { outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT", documentType: "INVOICE", dataSourceKey: "TRADE_INVOICE_PRINT_V1" },
  emailSource,
])("loads the admitted $layoutMode adapter using the stored draft", async mode => {
  if (mode.layoutMode === "EMAIL_FLOW") {
    mockEmailDraft();
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });
  } else {
    mocks.definition.mockResolvedValue({ ...template, ...mode });
    mocks.read.mockResolvedValue({ ...draft, editorDocument: { ...document, ...mode } });
    render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id })));
  }
  expect(await screen.findByLabelText(labels.designer.structure)).toBeTruthy();
  expect(mocks.read).toHaveBeenCalledOnce();
  expect(screen.queryByText(labels.designer.nativeUnavailable)).toBeNull();
});


it.each(["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS"] as const)(
  "applies ordinary Sales Quotation paper settings in %s",
  async layoutMode => {
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    onTestFinished(() => {
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scroll);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    });
    const bodyId = "01890000-0000-7000-8000-000000000012";
    const quotation = { ...template, layoutMode };
    const editorDocument: EditorDocument = {
      ...document, documentType: quotation.documentType, outputChannel: quotation.outputChannel,
      layoutMode, dataSourceKey: quotation.dataSourceKey, locale: quotation.locale,
      page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
        marginMm: { top: 12, end: 12, bottom: 12, start: 12 }, background: { kind: "SOLID", color: "#FFFFFF" } },
      theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827",
        accentColor: "#2563EB", surfaceColor: "#FFFFFF", lineHeight: 1.5 },
      rootNodeIds: [bodyId], nodes: {
        [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [], hidden: false, locked: false,
          layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      },
    };
    expect(validateTemplateDocumentModel(editorDocument).valid).toBe(true);
    mocks.definition.mockResolvedValue({ ...quotation, currentDraft: { ...quotation.currentDraft, contentChecksum: checksum(editorDocument) } });
    mocks.read.mockResolvedValue({ ...draft, editorDocument });
    const observer = observeMountedEditor();
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => Response.json({ success: true, data: { draft: {
      ...draft, revision: 4, etag: '"4"', editorDocument: JSON.parse(String(init?.body)).editorDocument,
    } } }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id }))); });

    const copy = pageCopies["en-US"];
    const pageTrigger = await screen.findByRole("tab", { name: labels.designer.page }, { timeout: 10_000 });
    fireEvent.mouseDown(pageTrigger, { button: 0, ctrlKey: false });
    const pageTab = await screen.findByRole("tabpanel", { name: labels.designer.page });
    fireEvent.click(within(pageTab).getByRole("button", { name: labels.pageSettings }));
    expect(screen.queryByLabelText(copy.background)).toBeNull();
    expect(screen.queryByRole("button", { name: copy.zones })).toBeNull();
    expect(screen.queryByRole("button", { name: copy.add })).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy.setup }));
    expect(screen.queryByLabelText(copy.background)).toBeNull();

    const setup = within(screen.getByRole("dialog", { name: copy.setup }));
    const dimensions = layoutMode === "FIXED_CANVAS"
      ? { preset: "A5", widthMm: 210, heightMm: 148 }
      : { preset: "CUSTOM", widthMm: 240.25, heightMm: 160.5 };
    fireEvent.keyDown(setup.getByRole("combobox", { name: copy.format }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "A5" }));
    const width = setup.getByRole("spinbutton", { name: copy.width });
    const height = setup.getByRole("spinbutton", { name: copy.height });
    expect(width).toHaveValue(148);
    expect(height).toHaveValue(210);
    if (layoutMode !== "FIXED_CANVAS") {
      fireEvent.keyDown(setup.getByRole("combobox", { name: copy.format }), { key: "Enter" });
      fireEvent.click(await screen.findByRole("option", { name: copy.custom }));
      fireEvent.change(width, { target: { value: "160.5" } });
      fireEvent.change(height, { target: { value: "240.25" } });
    }
    const orientation = setup.getByRole("combobox", { name: copy.orientation });
    fireEvent.keyDown(orientation, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: copy.landscape }));
    expect(orientation).toHaveTextContent(copy.landscape);
    expect(width).toHaveValue(dimensions.widthMm);
    expect(height).toHaveValue(dimensions.heightMm);
    fireEvent.change(setup.getByRole("spinbutton", { name: copy.start }), { target: { value: "20" } });
    fireEvent.click(setup.getByRole("button", { name: copy.apply }));

    const editor = () => observer.mock.results.at(-1)!.value as ReturnType<typeof useTemplateDesignEditor>;
    const expected = { ...editorDocument, page: { ...editorDocument.page, ...dimensions, orientation: "LANDSCAPE",
      marginMm: { top: 12, end: 12, bottom: 12, start: 20 } } };
    expect(editor().document).toEqual(expected);
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: copy.apply })).toBeNull());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(await screen.findByRole("button", { name: "Close settings" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => editor().undo());
    expect(editor().document).toEqual(editorDocument);
    expect(editor().canUndo).toBe(false);
    act(() => editor().redo());
    fireEvent.click(screen.getByRole("button", { name: labels.saveDraft }));
    await waitFor(() => expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument).toEqual(expected);
  },
  30_000,
);

it("clears a focused Flow quotation object without editing the draft", async () => {
  const bodyId = "01890000-0000-7000-8000-000000000002";
  const textId = "01890000-0000-7000-8000-000000000003";
  const flowTemplate = { ...template, layoutMode: "FLOW_DOCUMENT" as const };
  const editorDocument: EditorDocument = {
    ...document, documentType: flowTemplate.documentType, outputChannel: flowTemplate.outputChannel,
    layoutMode: flowTemplate.layoutMode, dataSourceKey: flowTemplate.dataSourceKey, locale: flowTemplate.locale,
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 14, bottom: 12, start: 10 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", accentColor: "#2563EB",
      surfaceColor: "#FFFFFF", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: {
      [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], hidden: false, locked: false,
        layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      [textId]: { ...emailText(textId, "Quotation heading", 0), parentId: bodyId },
    },
  };
  expect(validateTemplateDocumentModel(editorDocument).valid).toBe(true);
  mocks.definition.mockResolvedValue({ ...flowTemplate, currentDraft: { ...flowTemplate.currentDraft, contentChecksum: checksum(editorDocument) } });
  mocks.read.mockResolvedValue({ ...draft, editorDocument });
  render(createElement(I18nProvider, null, createElement(TemplateDesignWorkspace, { id })));

  const object = await screen.findByRole("button", { name: "Quotation heading" });
  object.focus();
  fireEvent.click(object);
  expect(object).toHaveAttribute("aria-pressed", "true");
  expect(fireEvent.keyDown(object, { key: "ArrowDown" })).toBe(true);
  fireEvent.keyDown(object, { key: "Escape" });
  expect(object).toHaveAttribute("aria-pressed", "false");
  expect(object).toHaveFocus();
  expect(screen.getByRole("button", { name: labels.undo })).toBeDisabled();
  expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
});

it("retains the freshest viewport through an in-flight acknowledgement and actual editor parent refresh", async () => {
  const second = "01890000-0000-7000-8000-000000000021";
  const detail = mockEmailDraft({ ...emailDraft, editorDocument: { ...emailDraft.editorDocument, rootNodeIds: [emailRoot, second],
    nodes: { ...emailDraft.editorDocument.nodes, [second]: emailText(second, "Second retained object", 1) } } });
  const observer = observeMountedEditor();
  let acknowledge: () => void = () => {};
  const fetchMock = vi.fn<typeof fetch>((_url, init) => new Promise(resolve => {
    acknowledge = () => resolve(Response.json({ success: true, data: { draft: { ...draft, revision: 4, etag: '\"4\"', editorDocument: JSON.parse(String(init?.body)).editorDocument } } }));
  })); vi.stubGlobal("fetch", fetchMock);
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  try {
    const props = { template: detail, canMutate: true, canPreview: false, backHref: "/core/templates" };
    const view = await act(async () => render(createElement(I18nProvider, null, createElement(TemplateDesignEditor, props))));
    await insertMountedEmailText(observer);
    fireEvent.click(screen.getByRole("button", { name: labels.saveDraft }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const zoom = screen.getByRole("combobox", { name: labels.designer.zoom });
    fireEvent.keyDown(zoom, { key: "Enter" }); fireEvent.click(await screen.findByRole("option", { name: "75%" }));
    fireEvent.click(screen.getByRole("button", { name: labels.designer.hand }));
    const canvas = screen.getByLabelText(labels.designer.canvas);
    fireEvent.keyDown(canvas, { key: "ArrowRight" }); fireEvent.keyDown(canvas, { key: "ArrowDown" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: labels.designer.design }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: labels.designer.layers }));
    fireEvent.click(await screen.findByRole("button", { name: "Second retained object" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => { acknowledge(); });
    expect(canvas.firstElementChild).toHaveStyle({ transform: "translate(24px, 24px) scale(0.75)" });
    expect(screen.getByRole("button", { name: labels.designer.hand })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: labels.saveDraft })).toBeDisabled();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).editorDocument;
    view.rerender(createElement(I18nProvider, null, createElement(TemplateDesignEditor, { ...props, template: {
      ...detail, name: "Refreshed server definition", currentDraft: {
        draftId: id, revision: 4, etag: '"4"', contentChecksum: checksum(body), validationState: "STALE",
      },
    } })));
    expect(screen.getByLabelText(labels.designer.canvas).firstElementChild).toHaveStyle({ transform: "translate(24px, 24px) scale(0.75)" });
    expect(screen.getByRole("combobox", { name: labels.designer.zoom })).toHaveTextContent("75%");
    fireEvent.click(screen.getByRole("button", { name: labels.designer.layers }));
    expect(await screen.findByRole("button", { name: "Second retained object" })).toHaveAttribute("aria-pressed", "true");
    expect(mocks.read).toHaveBeenCalledOnce();
    assertValidEmail(body);
    for (const key of ["zoom", "panX", "panY", "selectedId", "hand"]) expect(body).not.toHaveProperty(key);
  } finally { if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scroll); else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView; }
});
