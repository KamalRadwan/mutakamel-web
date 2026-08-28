// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, toastMock, authMock } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
  authMock: {
    user: {
      permissions: [
        "webphone.settings.read",
        "webphone.settings.update",
        "webphone.extensions.read",
        "webphone.extensions.manage",
      ],
    },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  unwrapCoreData: (payload: unknown) =>
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => authMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: {} }),
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));

import TenantWebphoneSettingsPage from "./page";

const CONFIG = {
  id: "0198c0de-0000-7000-8000-000000000001",
  tenantId: "0198c0de-0000-7000-8000-0000000000ff",
  enabled: true,
  sipDomain: "sip.example.com",
  realm: null,
  outboundProxy: null,
  fromDomain: null,
  registrarServer: null,
  contactUri: null,
  registerExpires: 600,
  sessionTimers: false,
  traceSip: false,
  allowInvalidTlsCertificate: false,
  iceTransportPolicy: "all",
  defaultCallerId: null,
  turnRestEnabled: false,
  turnRestTtlSeconds: 3600,
  endpoints: [],
  iceServers: [],
};

function moduleError(status: number, code: string) {
  return {
    response: { status, data: { code, message: `refused: ${code}` } },
  };
}

/** Every read refused the same way, as the entitlement guard does. */
function refuseAllReads(status: number, code: string) {
  api.get.mockRejectedValue(moduleError(status, code));
}

function resolveReads(seats: {
  allowed: number;
  occupied: number;
  available: number;
  overAllowance: boolean;
}) {
  api.get.mockImplementation((url: string) => {
    if (url.endsWith("/config")) return Promise.resolve({ data: { data: CONFIG } });
    if (url.endsWith("/extensions")) return Promise.resolve({ data: { data: [] } });
    if (url.endsWith("/seats")) return Promise.resolve({ data: { data: seats } });
    throw new Error(`unexpected request: ${url}`);
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  api.delete.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Tenant WebPhone settings — unavailable states", () => {
  it("renders the screen disabled, not hidden, when the module is not purchased", async () => {
    refuseAllReads(403, "WEBPHONE_MODULE_NOT_PURCHASED");
    render(<TenantWebphoneSettingsPage />);

    const notice = await screen.findByRole("status", {
      name: "WebPhone is not available on this workspace",
    });
    expect(
      within(notice).getByText("WebPhone is not part of your subscription"),
    ).toBeInTheDocument();

    // The capability is still advertised: the sections and their controls are
    // present, and every one of them is inert.
    expect(
      screen.getByRole("region", { name: "Server configuration" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("SIP domain")).toBeDisabled();
    expect(screen.getByRole("switch", { name: /WebPhone enabled/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      if (button.textContent?.includes("Reload")) continue;
      expect(button).toBeDisabled();
    }

    // An expected refusal is not an error.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("distinguishes provisioning-pending from not-purchased", async () => {
    refuseAllReads(409, "WEBPHONE_PROVISIONING_PENDING");
    render(<TenantWebphoneSettingsPage />);

    const notice = await screen.findByRole("status", {
      name: "WebPhone is not available on this workspace",
    });
    expect(
      within(notice).getByText("WebPhone is being set up"),
    ).toBeInTheDocument();
    expect(
      within(notice).getByText(/installation is still running/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("WebPhone is not part of your subscription"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a suspended subscription from the other two", async () => {
    refuseAllReads(403, "WEBPHONE_MODULE_INACTIVE");
    render(<TenantWebphoneSettingsPage />);

    const notice = await screen.findByRole("status", {
      name: "WebPhone is not available on this workspace",
    });
    expect(
      within(notice).getByText("Your WebPhone subscription is suspended"),
    ).toBeInTheDocument();
    expect(
      within(notice).getByText(/Existing phones keep working/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("WebPhone is being set up"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("attempts no write while the module is unavailable", async () => {
    refuseAllReads(403, "WEBPHONE_MODULE_NOT_PURCHASED");
    render(<TenantWebphoneSettingsPage />);
    await screen.findByRole("status", {
      name: "WebPhone is not available on this workspace",
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("still reports a genuine failure as an error", async () => {
    api.get.mockRejectedValue({
      response: { status: 500, data: { code: "WEBPHONE_INTERNAL_ERROR" } },
    });
    render(<TenantWebphoneSettingsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be loaded/i,
    );
    expect(
      screen.queryByRole("status", {
        name: "WebPhone is not available on this workspace",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("Tenant WebPhone settings — seat counter", () => {
  it("shows the seat counts when occupancy is within the allowance", async () => {
    resolveReads({ allowed: 10, occupied: 4, available: 6, overAllowance: false });
    render(<TenantWebphoneSettingsPage />);

    const seats = await screen.findByRole("region", { name: "Seats" });
    expect(within(seats).getByText("Within allowance")).toBeInTheDocument();
    expect(
      within(seats).getByText("Available").nextElementSibling,
    ).toHaveTextContent("6");
  });

  it("renders over-allowance honestly instead of a negative availability", async () => {
    // A seat reduction never auto-disables a working phone, so occupancy above
    // the allowance is a legitimate state the screen has to state plainly.
    resolveReads({
      allowed: 3,
      occupied: 5,
      available: 0,
      overAllowance: true,
    });
    render(<TenantWebphoneSettingsPage />);

    const seats = await screen.findByRole("region", { name: "Seats" });
    expect(
      within(seats).getByText("Over allowance: 2 over allowance"),
    ).toBeInTheDocument();
    expect(
      within(seats).getByText("Available").nextElementSibling,
    ).toHaveTextContent("0");
    expect(within(seats).queryByText("-2")).not.toBeInTheDocument();
    expect(
      within(seats).getByText(/More phones are enabled than your subscription allows/i),
    ).toBeInTheDocument();
  });

  it("never derives a negative availability from a bad response", async () => {
    // The server owns the clamp, but the screen must not depend on it.
    resolveReads({
      allowed: 3,
      occupied: 5,
      available: -2,
      overAllowance: false,
    });
    render(<TenantWebphoneSettingsPage />);

    const seats = await screen.findByRole("region", { name: "Seats" });
    await waitFor(() =>
      expect(
        within(seats).getByText("Available").nextElementSibling,
      ).toHaveTextContent("0"),
    );
    expect(
      within(seats).getByText("Over allowance: 2 over allowance"),
    ).toBeInTheDocument();
  });
});
