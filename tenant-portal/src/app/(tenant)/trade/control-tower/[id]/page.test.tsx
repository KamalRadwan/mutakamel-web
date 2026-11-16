// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { RESOLUTION_CODES, type ResolutionCode } from "../control-tower-contract";
import ControlTowerExceptionPage from "./page";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  headers: {},
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
}));
const dictionaries = { ar, en };
const directions = { ar: "rtl", en: "ltr" } as const;
const exceptionId = "01902001-3000-7000-8000-000000000001";
const detail = {
  id: exceptionId,
  sourceOwner: "worker-app",
  sourceType: "PDF_RENDER",
  sourceId: "01902001-3000-7000-8000-000000000003",
  category: "RENDER",
  severity: "HIGH",
  status: "OPEN",
  retryClass: "TRANSIENT",
  safeErrorCode: "RENDER_FAILED",
  correlationId: "01902001-3000-7000-8000-000000000004",
  resolvedAt: null,
  version: 7,
  updatedAt: "2026-10-31T00:00:00.000Z",
  asOf: "2026-10-31T00:00:05.000Z",
  attempts: [],
};

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[state.lang], lang: state.lang, dir: directions[state.lang] }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => dictionaries[state.lang],
  useLanguage: () => state.lang,
  useDirection: () => directions[state.lang],
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchId: null }),
  useTradeScope: () => ({ permissions: [], isTenantOwner: true, headers: state.headers }),
  hasTradePermission: () => true,
}));
vi.mock("../../trade-api", () => ({
  tradeGet: state.get,
  tradePost: state.post,
  tradeIfMatch: (version: number) => `"${version}"`,
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  DetailHeader: ({ secondaryActions }: { secondaryActions?: ReactNode }) => <header>{secondaryActions}</header>,
  useToast: () => ({ success: state.success, outcomeFromApi: () => false }),
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

async function renderPage() {
  const params = Promise.resolve({ id: exceptionId });
  await act(async () => {
    render(<Suspense fallback={null}><ControlTowerExceptionPage params={params} /></Suspense>);
  });
}

describe.each([
  { lang: "en" as const, t: en },
  { lang: "ar" as const, t: ar },
])("control-tower resolution ($lang)", ({ lang, t }) => {
  beforeEach(() => {
    state.lang = lang;
    state.get.mockReset().mockResolvedValue({ data: detail });
    state.post.mockReset().mockResolvedValue({ data: detail });
    state.success.mockReset();
  });

  async function openResolution() {
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: t.tradeControlTower.resolve }));
    return screen.getByRole("dialog", { name: t.tradeControlTower.resolve });
  }

  async function chooseCode(dialog: HTMLElement, code: ResolutionCode) {
    fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: t.tradeControlTower.resolutionCodes[code] }));
  }

  it("requires an explicit code even after a reason and evidence are entered", async () => {
    const dialog = await openResolution();
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.tradeGovernance.reason }), {
      target: { value: "Source checked" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.tradeControlTower.evidence }), {
      target: { value: '{"ticket":"OPS-42"}' },
    });
    expect(within(dialog).getByRole("combobox")).toHaveTextContent(t.tradeControlTower.resolutionCodePlaceholder);
    const confirm = within(dialog).getByRole("button", { name: t.tradeCommon.confirm });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(state.post).not.toHaveBeenCalled();
  });

  it.each(RESOLUTION_CODES)("posts the selected %s and the entered evidence", async (code) => {
    const dialog = await openResolution();
    await chooseCode(dialog, code);
    expect(within(dialog).getByRole("button", { name: t.tradeCommon.confirm })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.tradeGovernance.reason }), {
      target: { value: "  Source checked  " },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.tradeControlTower.evidence }), {
      target: { value: '{"ticket":"OPS-42","result":{"applied":true}}' },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: t.tradeCommon.confirm }));
    await waitFor(() => expect(state.post).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/control-tower/exceptions/${exceptionId}/resolve`,
      { resolutionCode: code, reason: "Source checked", evidence: { ticket: "OPS-42", result: { applied: true } } },
      expect.objectContaining({ headers: { "If-Match": '"7"' } }),
    ));
    expect(state.post).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed evidence locally and accepts a blank evidence field", async () => {
    const dialog = await openResolution();
    await chooseCode(dialog, "SOURCE_CORRECTED");
    const reason = within(dialog).getByRole("textbox", { name: t.tradeGovernance.reason });
    const evidence = within(dialog).getByRole("textbox", { name: t.tradeControlTower.evidence });
    fireEvent.change(reason, { target: { value: "Source checked" } });
    fireEvent.change(evidence, { target: { value: "{" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.tradeCommon.confirm }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(t.tradeControlTower.formEvidenceInvalid);
    expect(state.post).not.toHaveBeenCalled();
    expect(reason).toHaveValue("Source checked");
    fireEvent.change(evidence, { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.tradeCommon.confirm }));
    await waitFor(() => expect(state.post).toHaveBeenCalledWith(
      expect.stringContaining("/resolve"),
      { resolutionCode: "SOURCE_CORRECTED", reason: "Source checked", evidence: {} },
      expect.anything(),
    ));
  });

  it("starts a reopened resolution with no selection or previous evidence", async () => {
    const dialog = await openResolution();
    await chooseCode(dialog, "OWNER_RESULT_APPLIED");
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.tradeControlTower.evidence }), {
      target: { value: '{"ticket":"OPS-42"}' },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: t.common.cancel }));
    fireEvent.click(screen.getByRole("button", { name: t.tradeControlTower.resolve }));
    const reopened = screen.getByRole("dialog", { name: t.tradeControlTower.resolve });
    expect(within(reopened).getByRole("combobox")).toHaveTextContent(t.tradeControlTower.resolutionCodePlaceholder);
    expect(within(reopened).getByRole("textbox", { name: t.tradeGovernance.reason })).toHaveValue("");
    expect(within(reopened).getByRole("textbox", { name: t.tradeControlTower.evidence })).toHaveValue("");
    expect(within(reopened).getByRole("button", { name: t.tradeCommon.confirm })).toBeDisabled();
    expect(state.post).not.toHaveBeenCalled();
  });

  it("keeps the retry reason optional", async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: t.tradeControlTower.retry }));
    const dialog = screen.getByRole("dialog", { name: t.tradeControlTower.retry });
    fireEvent.click(within(dialog).getByRole("button", { name: t.tradeCommon.confirm }));
    await waitFor(() => expect(state.post).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/control-tower/exceptions/${exceptionId}/retry`, {}, expect.anything(),
    ));
  });
});
