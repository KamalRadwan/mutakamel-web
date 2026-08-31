// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, toastMock, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: ["admin.webphone.read", "admin.webphone.update"],
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
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));

import WebphoneSettingsPage from "./page";

const CONFIG = {
  id: "0198c0de-0000-7000-8000-000000000001",
  tenantId: null,
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
  turnRestEnabled: true,
  turnRestTtlSeconds: 3600,
  endpoints: [
    {
      id: "e1",
      label: "primary",
      websocketUrl: "wss://primary.example.com/ws",
      priority: 0,
      enabled: true,
    },
  ],
  iceServers: [
    {
      id: "i1",
      kind: "TURN",
      urls: ["turn:turn.example.com:3478"],
      username: "turnuser",
      credentialConfigured: true,
      enabled: true,
      sortOrder: 0,
    },
  ],
};

const EXTENSIONS = [
  {
    id: "x1",
    ownerId: "0198c0de-0000-7000-8000-0000000000aa",
    extension: "1001",
    sipUsername: "user1001",
    passwordConfigured: true,
    displayName: "Support desk",
    outboundCallerId: null,
    transport: "wss",
    enabled: true,
  },
];

const FLEET_SEATS = [
  {
    tenantId: "0198c0de-0000-7000-8000-0000000000bb",
    tenantName: "Acme",
    allowed: 2,
    occupied: 5,
    available: 0,
    overAllowance: true,
  },
];

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) => {
    if (url.includes("/fleet/seats")) {
      return Promise.resolve({ data: { data: FLEET_SEATS } });
    }
    if (url.endsWith("/extensions")) {
      return Promise.resolve({ data: { data: EXTENSIONS } });
    }
    if (url.endsWith("/config")) return Promise.resolve({ data: { data: CONFIG } });
    throw new Error(`unexpected request: ${url}`);
  });
  api.post.mockReset();
  api.patch.mockReset();
  api.delete.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Admin WebPhone settings", () => {
  it("reads the WebPhone module through its own canonical Gateway base", async () => {
    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "Server configuration" });

    for (const [url] of api.get.mock.calls) {
      expect(url).toMatch(/^\/api\/admin\/webphone\/v1\//);
    }
  });

  it("renders every section of the model", async () => {
    render(<WebphoneSettingsPage />);

    expect(
      await screen.findByRole("region", { name: "Server configuration" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "SIP endpoints" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ICE servers" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "TURN REST credentials" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Extensions" })).toBeInTheDocument();
  });

  it("shows a TURN credential only as a configured state, never as a value", async () => {
    render(<WebphoneSettingsPage />);
    const ice = await screen.findByRole("region", { name: "ICE servers" });

    expect(within(ice).getByText("Credential: Configured")).toBeInTheDocument();
    // The write-only field starts blank so nothing stored can be read back.
    expect(
      within(ice).getByLabelText("TURN credential (write-only)"),
    ).toHaveValue("");
  });

  it("keeps the seat counter honest when a tenant is over its allowance", async () => {
    render(<WebphoneSettingsPage />);
    const seats = await screen.findByRole("region", {
      name: "Tenant seat usage",
    });

    expect(
      within(seats).getByText("Over allowance: 3 over allowance"),
    ).toBeInTheDocument();
    expect(
      within(seats).getByText("Available").nextElementSibling,
    ).toHaveTextContent("0");
  });

  it("lists the TURN URIs a minted credential would be valid for", async () => {
    render(<WebphoneSettingsPage />);
    const turn = await screen.findByRole("region", {
      name: "TURN REST credentials",
    });

    expect(
      within(turn).getByText("turn:turn.example.com:3478"),
    ).toBeInTheDocument();
  });

  it("hides every write control from a read-only operator", async () => {
    authMock.user.permissions = ["admin.webphone.read"];
    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "Server configuration" });

    expect(
      screen.getByText(
        "Read-only view. Changes require the admin.webphone.update permission.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("SIP domain")).toBeDisabled();
    expect(
      screen.queryByRole("form", { name: "Add endpoint" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save configuration" }),
    ).not.toBeInTheDocument();

    authMock.user.permissions = ["admin.webphone.read", "admin.webphone.update"];
  });
});
