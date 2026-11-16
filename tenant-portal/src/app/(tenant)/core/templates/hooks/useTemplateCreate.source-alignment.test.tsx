// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import owners from "../template-owner-metadata.fixture.json";
import letter from "../letter-authoring.fixture.json";
import { parseTemplateSourceMetadata } from "../template-source-metadata";
import { parseTemplateStarters } from "../template-discovery-contract";
import { STARTER_CATALOGUE_DATA } from "../starter-catalogue.data";
import { useTemplateCreate } from "./useTemplateCreate";

const auth = vi.hoisted(() => {
  const tenantWide = { tenantWide: true, companyIds: [] as string[], branchIds: [] as string[] };
  const user = { id: "actor", permissions: ["templates.read", "templates.create"],
    permissionScopes: { "templates.read": tenantWide, "templates.create": tenantWide } };
  const listeners = new Set<() => void>();
  let commit = { user, sessionRevision: "session-a", sequence: 0 };
  return {
    user, authState: "AUTHENTICATED",
    readReadyProfileCommit: () => commit,
    subscribeProfileReadiness(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    commitSession(sessionRevision: string, nextUser = user) {
      commit = { user: nextUser, sessionRevision, sequence: commit.sequence + 1 };
      listeners.forEach(listener => listener());
    },
  };
});
const api = vi.hoisted(() => ({ scopes: vi.fn(), sources: vi.fn(), starters: vi.fn(), create: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../templates-api", () => ({ fetchCreationScopes: api.scopes, fetchTemplateStarters: api.starters, createTemplate: api.create }));
vi.mock("../template-data-sources-api", () => ({ fetchTemplateDataSources: api.sources }));

beforeEach(() => {
  auth.commitSession("session-a");
  api.scopes.mockReset().mockResolvedValue([{ type: "TENANT", companyId: null, label: "Workspace" }]);
  api.sources.mockReset().mockResolvedValue(owners.map(parseTemplateSourceMetadata));
  api.starters.mockReset().mockResolvedValue([]);
  api.create.mockReset().mockResolvedValue({ id: "created" });
});
afterEach(cleanup);

it("derives document/adapter/layout choices from the current guarded server catalogue", async () => {
  api.sources.mockResolvedValue(owners.map(item => parseTemplateSourceMetadata(item.adapterKey === "TRADE_INVOICE_PRINT_V1"
    ? { ...item, allowedLayoutModes: ["FIXED_CANVAS"] } : item)));
  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(result.current.hasCompatibleSource).toBe(true));
  act(() => result.current.change({ documentType: "INVOICE" }));
  expect(result.current.adapterKeys).toEqual(["TRADE_INVOICE_PRINT_V1"]);
  expect(result.current.layoutModes).toEqual(["FIXED_CANVAS"]);
  expect(result.current.values).toMatchObject({ dataSourceKey: "TRADE_INVOICE_PRINT_V1", layoutMode: "FIXED_CANVAS", outputChannel: "PRINT" });
  act(() => result.current.change({ documentType: "CRM_OUTBOUND_EMAIL" }));
  expect(result.current.layoutModes).toEqual(["EMAIL_FLOW"]);
  expect(result.current.outputChannels).toEqual(["EMAIL"]);
  await waitFor(() => expect(api.starters).toHaveBeenLastCalledWith(expect.objectContaining({
    documentType: "CRM_OUTBOUND_EMAIL", outputChannel: "EMAIL", layoutMode: "EMAIL_FLOW",
  }), expect.any(AbortSignal), expect.any(Function)));
});

it.each(["TENANT", "COMPANY"] as const)("selects a server-admitted Letter and creates a blank draft in the %s scope", async type => {
  const companyId = "019f0000-0000-7000-8000-000000000077";
  const otherCompany = "019f0000-0000-7000-8000-000000000078";
  const destination = type === "COMPANY" ? { type, companyId } : { type };
  api.scopes.mockResolvedValue([{ type, companyId: type === "COMPANY" ? companyId : null, label: "Authorized destination" }]);
  api.sources.mockResolvedValue([parseTemplateSourceMetadata(owners[0]), parseTemplateSourceMetadata(letter.owner)]);
  api.starters.mockImplementation(async query => parseTemplateStarters({ items: letter.starters.filter(starter =>
    starter.dataSourceKey === query.dataSourceKey && starter.layoutMode === query.layoutMode && starter.locale === query.locale) }));

  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(result.current.documentTypes).toContain("LETTER"));
  act(() => result.current.change({ documentType: "LETTER", layoutMode: "FLOW_DOCUMENT" }));
  expect(result.current.adapterKeys).toEqual(["CORE_BUSINESS_LETTER_PRINT_V1"]);
  expect(result.current.layoutModes).toEqual(letter.owner.allowedLayoutModes);
  await waitFor(() => expect(result.current.starters).toHaveLength(1));
  const starter = result.current.starters[0]!;
  act(() => result.current.change({ starterKey: starter.starterKey }));
  const { defaultPage } = starter;
  expect(defaultPage).toBeDefined();
  expect(result.current.values.page.top).toBe(String(defaultPage!.marginMm.top));

  act(() => result.current.change({ starterKey: "", code: "LETTER_BLANK", name: "Blank business letter" }));
  await act(async () => { await expect(result.current.submit()).resolves.toBe(true); });
  const [payload] = api.create.mock.calls[0];
  expect(payload).toMatchObject({
    documentType: "LETTER", dataSourceKey: letter.owner.adapterKey, layoutMode: "FLOW_DOCUMENT",
    outputChannel: "PRINT", scope: destination,
    page: { preset: "A4", orientation: "PORTRAIT", marginMm: { top: 15, end: 15, bottom: 15, start: 15 } },
  });
  expect(payload).not.toHaveProperty("starterKey");

  act(() => auth.commitSession("letter-scope-revoked", { ...auth.user,
    permissionScopes: { ...auth.user.permissionScopes, "templates.create": {
      tenantWide: false, companyIds: [otherCompany], branchIds: [],
    } },
  }));
  expect(result.current.documentTypes).not.toContain("LETTER");
  await waitFor(() => expect(result.current.scope).toBeNull());
  await act(async () => { await expect(result.current.submit()).resolves.toBe(false); });
  expect(api.create).toHaveBeenCalledTimes(1);
});

it("withholds source choices immediately when the authenticated session changes", async () => {
  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(result.current.hasCompatibleSource).toBe(true));
  api.scopes.mockReturnValue(new Promise(() => {}));
  act(() => auth.commitSession("session-b"));
  expect(result.current.hasCompatibleSource).toBe(false);
  expect(result.current.documentTypes).toEqual([]);
  await act(async () => { await result.current.submit(); });
  expect(api.create).not.toHaveBeenCalled();
});

it.each(["FLOW_DOCUMENT", "FIXED_CANVAS"])("uses the exact server starter page for %s and preserves custom page edits", async layoutMode => {
  const descriptor = STARTER_CATALOGUE_DATA.find(({ descriptor }) => descriptor.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" &&
    descriptor.layoutMode === layoutMode && descriptor.locale === "en-US")!.descriptor;
  const defaultPage = { preset: "A4", orientation: "PORTRAIT", marginMm: { top: 12, end: 12, bottom: 12, start: 12 } };
  api.starters.mockImplementation(async query => query.layoutMode === layoutMode
    ? parseTemplateStarters({ items: [{ ...descriptor, defaultPage }] }) : []);
  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(result.current.hasCompatibleSource).toBe(true));
  act(() => result.current.change({ layoutMode: descriptor.layoutMode }));
  await waitFor(() => expect(result.current.starters).toHaveLength(1));
  expect(result.current.values.page.top).toBe("15");
  act(() => result.current.change({ starterKey: descriptor.starterKey, code: "SALES_QUOTATION", name: "Sales quotation" }));
  expect(result.current.values.page.top).toBe("12");
  await act(async () => { await result.current.submit(); });
  expect(api.create).toHaveBeenLastCalledWith(expect.objectContaining({ layoutMode, starterKey: descriptor.starterKey, page: defaultPage }),
    expect.any(AbortSignal), expect.any(Function));
  act(() => result.current.change({ page: { ...result.current.values.page, top: "13" } }));
  act(() => result.current.change({ starterKey: "" }));
  act(() => result.current.change({ starterKey: descriptor.starterKey }));
  expect(result.current.values.page).toMatchObject({ top: "13", end: "12" });
});

it("keeps a source denial distinct from a successful empty catalogue", async () => {
  api.sources.mockRejectedValue(new TenantApiClientError("Forbidden", {
    status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "ACCESS_POLICY_BLOCKED" },
  }, "http"));
  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(result.current.sourceError?.status).toBe(403));
  expect(result.current.hasCompatibleSource).toBe(false);
  expect(result.current.documentTypes).toEqual([]);
});

it("ignores a late source response belonging to a retired authenticated session", async () => {
  let finish: (value: unknown) => void = () => {};
  api.sources.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useTemplateCreate(true));
  await waitFor(() => expect(api.sources).toHaveBeenCalledTimes(1));
  const [, signal] = api.sources.mock.calls[0];
  api.sources.mockResolvedValue([parseTemplateSourceMetadata(owners[4])]);
  act(() => auth.commitSession("session-b"));
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(result.current.values.dataSourceKey).toBe("TRADE_INVOICE_PRINT_V1"));
  await act(async () => { finish([parseTemplateSourceMetadata(owners[0])]); });
  expect(result.current.values.dataSourceKey).toBe("TRADE_INVOICE_PRINT_V1");
  expect(result.current.documentTypes).toEqual(["INVOICE"]);
});
