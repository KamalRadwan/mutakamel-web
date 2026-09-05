// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Radix Switch measures its thumb through ResizeObserver, which jsdom does not
// implement. The stub only has to exist; nothing here asserts on measurement.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { api, toastMock, authMock } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
// The real module the `@/design-system` barrel re-exports `useToast` from.
// Mocking the barrel itself would replace every primitive the screen renders;
// this replaces only the toaster, which is the one thing under assertion.
vi.mock("@/design-system/feedback/useToast", () => ({
  useToast: () => toastMock,
}));

import TenantWebphoneSettingsPage from "./page";

/**
 * The whole of `GET /config`. The scope stores nothing: `enabled` is derived
 * from the servers, and there is no `PATCH` for any of it. A fixture richer
 * than the real response is how this screen drifted from the API last time, so
 * this one is kept exactly as wide as the endpoint.
 */
const CONFIG = {
  tenantId: "0198c0de-0000-7000-8000-0000000000t1",
  enabled: true,
};

const PRIMARY_SERVER = {
  id: "0198c0de-0000-7000-8000-00000000a001",
  name: "Cairo primary",
  sipDomain: "sip.example.com",
  websocketUrl: "wss://primary.example.com/ws",
  priority: 1,
  enabled: true,
  realm: null,
  outboundProxy: null,
  fromDomain: null,
  registrarServer: null,
  contactUri: null,
  registerExpires: 600,
  defaultCallerId: null,
  iceTransportPolicy: "all",
  traceSip: false,
  sessionTimers: false,
  allowInvalidTlsCertificate: false,
  defaultTimeoutSeconds: 10,
  defaultMaxRetries: 2,
  iceServers: [],
};

const BACKUP_SERVER = {
  ...PRIMARY_SERVER,
  id: "0198c0de-0000-7000-8000-00000000a002",
  name: "Cairo backup",
  websocketUrl: "wss://backup.example.com/ws",
  priority: 2,
  enabled: false,
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

function resolveReads(
  seats: {
    allowed: number;
    occupied: number;
    available: number;
    overAllowance: boolean;
  },
  servers: unknown[] = [],
) {
  api.get.mockImplementation((url: string) => {
    if (url.endsWith("/config")) return Promise.resolve({ data: { data: CONFIG } });
    if (url.endsWith("/servers")) {
      return Promise.resolve({ data: { data: servers } });
    }
    if (url.endsWith("/extensions")) return Promise.resolve({ data: { data: [] } });
    if (url.endsWith("/seats")) return Promise.resolve({ data: { data: seats } });
    throw new Error(`unexpected request: ${url}`);
  });
}

const SEATS = { allowed: 10, occupied: 4, available: 6, overAllowance: false };

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
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
    expect(screen.getByRole("region", { name: "SIP servers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Extensions" })).toBeInTheDocument();
    expect(screen.getByLabelText("SIP domain")).toBeDisabled();
    expect(screen.getByLabelText("Server name")).toBeDisabled();
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
    expect(api.put).not.toHaveBeenCalled();
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

describe("Tenant WebPhone settings — the server chain", () => {
  it("shows each server's position as a badge and offers no priority field", async () => {
    resolveReads(SEATS, [PRIMARY_SERVER, BACKUP_SERVER]);
    render(<TenantWebphoneSettingsPage />);

    const primary = await screen.findByRole("article", {
      name: "SIP server: Cairo primary",
    });
    expect(within(primary).getByLabelText("Position 1")).toHaveTextContent("1");
    const backup = screen.getByRole("article", {
      name: "SIP server: Cairo backup",
    });
    expect(within(backup).getByLabelText("Position 2")).toHaveTextContent("2");

    // Position is renumbered wholesale by the reorder endpoint, so it is never
    // offered as something to type.
    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
  });

  it("keeps the advanced fields collapsed until they are asked for", async () => {
    resolveReads(SEATS, [PRIMARY_SERVER]);
    render(<TenantWebphoneSettingsPage />);

    const card = await screen.findByRole("article", {
      name: "SIP server: Cairo primary",
    });
    expect(within(card).getByLabelText("Server name")).toHaveValue(
      "Cairo primary",
    );
    expect(
      within(card).queryByLabelText("Authentication realm"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(card).getByRole("button", { name: /Advanced settings/ }),
    );
    expect(
      await within(card).findByLabelText("Authentication realm"),
    ).toBeInTheDocument();
    expect(
      within(card).getByLabelText("Attempts before moving to the next server"),
    ).toBeInTheDocument();
  });

  it("reorders by sending the whole id list under an idempotency key", async () => {
    resolveReads(SEATS, [PRIMARY_SERVER, BACKUP_SERVER]);
    api.put.mockResolvedValue({ data: { data: null } });
    render(<TenantWebphoneSettingsPage />);

    const moveLater = await screen.findByRole("button", {
      name: "Move later: Cairo primary",
    });
    fireEvent.click(moveLater);

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body, config] = api.put.mock.calls[0];
    expect(url).toBe("/api/tenant/webphone/v1/servers/order");
    // The full chain in its new order — the endpoint takes no delta.
    expect(body).toEqual({ ids: [BACKUP_SERVER.id, PRIMARY_SERVER.id] });
    expect(config.headers["x-idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("cannot move the first server earlier or the last one later", async () => {
    resolveReads(SEATS, [PRIMARY_SERVER, BACKUP_SERVER]);
    render(<TenantWebphoneSettingsPage />);

    expect(
      await screen.findByRole("button", { name: "Move earlier: Cairo primary" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move later: Cairo backup" }),
    ).toBeDisabled();
  });

  it("nests each server's ICE list inside its own card", async () => {
    resolveReads(SEATS, [
      {
        ...PRIMARY_SERVER,
        iceServers: [
          {
            id: "0198c0de-0000-7000-8000-00000000b001",
            kind: "TURN",
            urls: ["turn:turn.example.com:3478"],
            username: "turnuser",
            credentialConfigured: true,
            enabled: true,
            sortOrder: 0,
          },
        ],
      },
      BACKUP_SERVER,
    ]);
    render(<TenantWebphoneSettingsPage />);

    const primary = await screen.findByRole("article", {
      name: "SIP server: Cairo primary",
    });
    expect(
      within(primary).getByRole("region", { name: "ICE servers: Cairo primary" }),
    ).toBeInTheDocument();
    expect(
      within(primary).getByRole("article", {
        name: "ICE server: turn:turn.example.com:3478",
      }),
    ).toBeInTheDocument();

    // The backup lives in a different network, so it does not inherit the
    // primary's relay.
    const backup = screen.getByRole("article", {
      name: "SIP server: Cairo backup",
    });
    expect(
      within(backup).getByText("No ICE server is configured for this server yet."),
    ).toBeInTheDocument();
  });

  it("shows each server's TURN entry on the server that owns it", async () => {
    // TURN is described in exactly one editable place: the server whose network
    // the relay is reachable in. Two servers may legitimately list the same
    // URI, and each states it for itself rather than through a scope-level
    // summary that outlived the settings it belonged to.
    const turn = {
      id: "0198c0de-0000-7000-8000-00000000b001",
      kind: "TURN",
      urls: ["turn:shared.example.com:3478"],
      username: "turnuser",
      credentialConfigured: true,
      enabled: true,
      sortOrder: 0,
    };
    resolveReads(SEATS, [
      { ...PRIMARY_SERVER, iceServers: [turn] },
      {
        ...BACKUP_SERVER,
        iceServers: [{ ...turn, id: "0198c0de-0000-7000-8000-00000000b002" }],
      },
    ]);
    render(<TenantWebphoneSettingsPage />);

    for (const name of ["Cairo primary", "Cairo backup"]) {
      const card = await screen.findByRole("article", {
        name: `SIP server: ${name}`,
      });
      expect(
        within(card).getByRole("article", {
          name: "ICE server: turn:shared.example.com:3478",
        }),
      ).toBeInTheDocument();
    }
  });
});

describe("Tenant WebPhone settings — the scope has no stored settings", () => {
  it("offers no scope-level switch or TURN REST controls", async () => {
    // `enabled` is derived from the servers and TURN REST minting is an
    // environment concern, so neither is a control here. Offering either would
    // be a switch whose write the API no longer has a route for.
    resolveReads(SEATS, [PRIMARY_SERVER]);
    render(<TenantWebphoneSettingsPage />);
    await screen.findByRole("region", { name: "SIP servers" });

    expect(
      screen.queryByRole("region", { name: "WebPhone module" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "TURN REST credentials" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /WebPhone enabled/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Credential lifetime (seconds)"),
    ).not.toBeInTheDocument();
    // Saving is per row now. Every save button on the screen belongs to the
    // server or ICE entry that owns the fields it writes — none of them saves
    // the scope, because the scope has nothing to save.
    for (const button of screen.getAllByRole("button", {
      name: /Save configuration/,
    })) {
      expect(button.closest("article")).not.toBeNull();
    }
  });

  it("never writes to the configuration endpoint, which no longer exists", async () => {
    // `PATCH /config` was removed with the settings row behind it; a call to it
    // now returns 404 GW.ROUTE.UNKNOWN.
    resolveReads(SEATS, [PRIMARY_SERVER]);
    api.patch.mockResolvedValue({ data: { data: null } });
    render(<TenantWebphoneSettingsPage />);

    const card = await screen.findByRole("article", {
      name: "SIP server: Cairo primary",
    });
    fireEvent.change(within(card).getByLabelText("Server name"), {
      target: { value: "Cairo edge" },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Save configuration" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    // The one write went to the server that owns the field, not to the scope.
    expect(api.patch.mock.calls[0][0]).toBe(
      `/api/tenant/webphone/v1/servers/${PRIMARY_SERVER.id}`,
    );
    for (const [url] of api.patch.mock.calls) {
      expect(url).not.toMatch(/\/config$/);
    }
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
