// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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

import WebphoneSettingsPage from "./page";

const TURN_URL = "turn:turn.example.com:3478";

const SERVERS = [
  {
    id: "s1",
    name: "Primary",
    sipDomain: "sip.example.com",
    websocketUrl: "wss://primary.example.com/ws",
    priority: 0,
    enabled: true,
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    defaultCallerId: null,
    iceTransportPolicy: "all",
    iceEnabled: true,
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    defaultTimeoutSeconds: 15,
    defaultMaxRetries: 1,
    iceServers: [
      {
        id: "i1",
        kind: "TURN",
        urls: [TURN_URL],
        username: "turnuser",
        credentialConfigured: true,
        enabled: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "s2",
    name: "Backup",
    sipDomain: "backup.example.com",
    websocketUrl: "ws://backup.example.com/ws",
    priority: 1,
    enabled: false,
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    defaultCallerId: null,
    iceTransportPolicy: "all",
    iceEnabled: true,
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    defaultTimeoutSeconds: 20,
    defaultMaxRetries: 2,
    iceServers: [],
  },
];

/** The same list, with the master ICE switch of the first server turned off. */
const SERVERS_WITH_ICE_OFF = [
  { ...SERVERS[0], iceEnabled: false },
  SERVERS[1],
];

function respondWith(servers: unknown[]) {
  api.get.mockImplementation((url: string) => {
    if (url.endsWith("/servers")) {
      return Promise.resolve({ data: { data: servers } });
    }
    throw new Error(`unexpected request: ${url}`);
  });
}

/** The advanced disclosure is closed on load; ICE lives inside it. */
async function openAdvanced(serverLabel: string) {
  const card = await screen.findByRole("article", { name: serverLabel });
  fireEvent.click(
    within(card).getByRole("button", { name: /Show advanced settings/ }),
  );
  return card;
}

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) => {
    if (url.endsWith("/servers")) {
      return Promise.resolve({ data: { data: SERVERS } });
    }
    throw new Error(`unexpected request: ${url}`);
  });
  api.post.mockReset().mockResolvedValue({ data: { data: null } });
  api.patch.mockReset().mockResolvedValue({ data: { data: null } });
  api.put.mockReset().mockResolvedValue({ data: { data: null } });
  api.delete.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Admin WebPhone settings", () => {
  it("reads the WebPhone module through its own canonical Gateway base", async () => {
    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "SIP servers" });

    for (const [url] of api.get.mock.calls) {
      expect(url).toMatch(/^\/api\/admin\/webphone\/v1\//);
    }
  });

  it("is the SIP server chain and nothing else", async () => {
    render(<WebphoneSettingsPage />);

    expect(
      await screen.findByRole("region", { name: "SIP servers" }),
    ).toBeInTheDocument();

    // The module switch, TURN REST minting and extensions belong elsewhere:
    // extensions to the user's own page, the rest to nobody on this screen.
    expect(
      screen.queryByRole("region", { name: "WebPhone module" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "TURN REST credentials" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Extensions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Tenant seat usage" }),
    ).not.toBeInTheDocument();
  });

  it("keeps everything but the reachability fields behind the advanced disclosure", async () => {
    render(<WebphoneSettingsPage />);
    const primary = await screen.findByRole("article", {
      name: "SIP server 1: Primary",
    });

    // Basic: what decides whether a browser can reach the server at all.
    expect(within(primary).getByLabelText("Name")).toBeInTheDocument();
    expect(within(primary).getByLabelText("SIP domain")).toBeInTheDocument();
    expect(within(primary).getByLabelText("WebSocket URL")).toBeInTheDocument();

    // Everything else, ICE included, is not rendered until asked for.
    expect(
      within(primary).queryByLabelText("Authentication realm"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "ICE servers: Primary" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(primary).getByRole("button", { name: /Show advanced settings/ }),
    );

    for (const group of [
      "SIP identity and routing",
      "Registration",
      "Media and ICE",
      "Diagnostics",
      "Failover defaults",
    ]) {
      expect(
        within(primary).getByRole("group", { name: group }),
      ).toBeInTheDocument();
    }
    expect(
      within(primary).getByRole("group", { name: "ICE servers: Primary" }),
    ).toBeInTheDocument();
    expect(
      within(primary).getByLabelText("Default timeout (seconds)"),
    ).toBeInTheDocument();
  });

  it("states the per-server ICE empty case once, on the server that is empty", async () => {
    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const backup = await openAdvanced("SIP server 2: Backup");

    // Exactly one: the settings-level copy of this line was a duplicate of the
    // per-server one and said nothing about any particular server.
    expect(
      screen.getAllByText("No ICE server is configured for this server yet."),
    ).toHaveLength(1);
    expect(
      within(backup).getByText(
        "No ICE server is configured for this server yet.",
      ),
    ).toBeInTheDocument();
  });

  it("shows each server's failover position as a badge, never as an input", async () => {
    render(<WebphoneSettingsPage />);
    const primary = await screen.findByRole("article", {
      name: "SIP server 1: Primary",
    });
    const backup = screen.getByRole("article", { name: "SIP server 2: Backup" });

    expect(within(primary).getByLabelText("Order position: 1")).toHaveTextContent(
      "1",
    );
    expect(within(backup).getByLabelText("Order position: 2")).toHaveTextContent(
      "2",
    );
    // Priority is the position in the list, so no control may offer to set it.
    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
  });

  it("writes the whole order when a server is moved", async () => {
    render(<WebphoneSettingsPage />);
    const backup = await screen.findByRole("article", {
      name: "SIP server 2: Backup",
    });

    fireEvent.click(
      within(backup).getByRole("button", {
        name: "Move earlier in the failover order: Backup",
      }),
    );

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body, options] = api.put.mock.calls[0];
    expect(url).toBe("/api/admin/webphone/v1/servers/order");
    expect(body).toEqual({ ids: ["s2", "s1"] });
    expect(options.headers["x-idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(
      await screen.findByText("The failover order was saved."),
    ).toBeInTheDocument();
  });

  it("adds a server in one click, with no form to fill in first", async () => {
    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "SIP servers" });

    // There is no create form: the card the server arrives as is its editor.
    expect(
      screen.queryByRole("form", { name: "Add server" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add server" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body, options] = api.post.mock.calls[0];
    expect(url).toBe("/api/admin/webphone/v1/servers");
    expect(body).toMatchObject({
      name: "New server",
      sipDomain: "example.invalid",
      websocketUrl: "wss://example.invalid/ws",
      // Appended to a live chain, so it must not take calls before it is real.
      enabled: false,
    });
    expect(options.headers["x-idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });

  it("numbers the added server when the plain name is already taken", async () => {
    api.get.mockImplementation((url: string) => {
      if (url.endsWith("/servers")) {
        return Promise.resolve({
          data: { data: [{ ...SERVERS[0], name: "New server" }] },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    });

    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "SIP servers" });
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ name: "New server 2" });
  });

  it("surfaces a failed creation next to the button that caused it", async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          errorCode: "WEBPHONE_SERVER_LIMIT_REACHED",
          message: "limit",
        },
      },
    });

    render(<WebphoneSettingsPage />);
    await screen.findByRole("region", { name: "SIP servers" });
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The maximum number of SIP servers is already configured.",
    );
  });

  it("persists a server's on/off switch the moment it changes", async () => {
    render(<WebphoneSettingsPage />);
    const primary = await screen.findByRole("article", {
      name: "SIP server 1: Primary",
    });

    const toggle = within(primary).getByRole("switch", {
      name: "Server enabled",
    });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][0]).toBe(
      "/api/admin/webphone/v1/servers/s1",
    );
    expect(api.patch.mock.calls[0][1]).toEqual({ enabled: false });
    expect(await within(primary).findByText("Saved.")).toBeInTheDocument();
  });

  it("puts the ICE master switch above the policy and the entries", async () => {
    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");
    const media = within(primary).getByRole("group", { name: "Media and ICE" });

    const master = within(media).getByRole("switch", {
      name: "Use ICE on this server",
    });
    expect(master).toBeChecked();

    // Document order is the reading order: the switch governs both the policy
    // below it and the entry list below that.
    const policy = within(media).getByLabelText("ICE transport policy");
    const entries = within(media).getByRole("group", {
      name: "ICE servers: Primary",
    });
    expect(
      master.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      master.compareDocumentPosition(entries) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // It is not the per-entry switch wearing a different label.
    expect(
      within(entries).getByRole("switch", { name: "ICE server enabled" }),
    ).toBeInTheDocument();
  });

  it("persists the ICE master switch the moment it changes, alone in the body", async () => {
    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");

    fireEvent.click(
      within(primary).getByRole("switch", { name: "Use ICE on this server" }),
    );

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][0]).toBe(
      "/api/admin/webphone/v1/servers/s1",
    );
    // Exactly this and nothing else: the server's own enabled state, its name
    // and its ICE entries all have other owners.
    expect(api.patch.mock.calls[0][1]).toEqual({ iceEnabled: false });
    expect(await within(primary).findByText("Saved.")).toBeInTheDocument();
    // Both halves of what this switch does, in its own help line: what it
    // changes, and when it is written. Neither is left to be inferred from the
    // Save button further down the card.
    expect(
      within(primary).getByText(
        /kept exactly as they are and come back the moment it is switched on\. Saved the moment it changes/u,
      ),
    ).toBeInTheDocument();
  });

  it("puts the ICE master switch back when the write is refused, and says why", async () => {
    api.patch.mockRejectedValue({
      response: {
        status: 422,
        data: {
          success: false,
          errorCode: "WEBPHONE_RELAY_WITHOUT_TURN",
          message: "relay",
        },
      },
    });

    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");
    const master = within(primary).getByRole("switch", {
      name: "Use ICE on this server",
    });
    fireEvent.click(master);

    expect(await within(primary).findByRole("alert")).toHaveTextContent(
      "Relay-only transport needs ICE switched on for this server",
    );
    // Optimism undone: the switch must not keep claiming a state the server
    // rejected.
    await waitFor(() =>
      expect(
        within(primary).getByRole("switch", { name: "Use ICE on this server" }),
      ).toBeChecked(),
    );
  });

  it("keeps a parked server's ICE entries visible, legible and explained", async () => {
    respondWith(SERVERS_WITH_ICE_OFF);

    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");
    const entries = within(primary).getByRole("group", {
      name: "ICE servers: Primary",
    });

    // Not hidden: this screen is where the switch is put back, so the operator
    // has to be able to see what they would be restoring.
    const entry = within(entries).getByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });
    expect(entry).toBeInTheDocument();
    // Said in words, not conveyed by dimming alone.
    expect(
      within(entries).getByText(
        "ICE is switched off for this server, so none of the entries below is being used.",
        { exact: false },
      ),
    ).toBeInTheDocument();
    // Still operable, and its own switch still shows the state it was parked
    // in — that is what makes switching ICE back on restore the set exactly.
    expect(within(entry).getByLabelText("URLs")).toBeEnabled();
    expect(
      within(entry).getByRole("switch", { name: "ICE server enabled" }),
    ).toBeChecked();
  });

  it("refuses relay-only transport while ICE is parked, before sending it", async () => {
    respondWith(SERVERS_WITH_ICE_OFF);

    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");

    fireEvent.change(
      within(primary).getByLabelText("ICE transport policy"),
      { target: { value: "relay" } },
    );
    // Collapsed first so the card's own Save is the only one on screen — the
    // ICE entries each carry one of their own. Saving reopens the disclosure,
    // which is the behaviour that puts the message where the operator is
    // looking rather than behind a closed panel.
    fireEvent.click(
      within(primary).getByRole("button", { name: /Hide advanced settings/ }),
    );
    fireEvent.click(within(primary).getByRole("button", { name: "Save" }));

    expect(
      await within(primary).findByText(
        "ICE is switched off for this server, so relay-only transport would leave every call without a media path.",
        { exact: false },
      ),
    ).toBeInTheDocument();
    // Knowable from what is already on screen, so nothing is sent.
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("persists an ICE entry's on/off switch without any save action", async () => {
    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });

    const toggle = within(entry).getByRole("switch", {
      name: "ICE server enabled",
    });
    expect(toggle).toBeChecked();
    // The bug this replaced: the checkbox rendered its stored state, nothing
    // was bound to it, and no save on the screen ever carried `enabled`.
    fireEvent.click(toggle);

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][0]).toBe(
      "/api/admin/webphone/v1/servers/s1/ice-servers/i1",
    );
    expect(api.patch.mock.calls[0][1]).toEqual({ enabled: false });
    expect(await within(entry).findByText("Saved.")).toBeInTheDocument();
  });

  it("puts an ICE switch back when the write is refused, and says why", async () => {
    api.patch.mockRejectedValue({
      response: {
        status: 422,
        data: {
          success: false,
          errorCode: "WEBPHONE_RELAY_WITHOUT_TURN",
          message: "relay",
        },
      },
    });

    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });
    fireEvent.click(
      within(entry).getByRole("switch", { name: "ICE server enabled" }),
    );

    expect(await within(entry).findByRole("alert")).toHaveTextContent(
      "Relay-only transport needs ICE switched on for this server and at least one enabled TURN entry",
    );
    // Optimism has to be undone, or the switch would keep claiming a state the
    // server rejected.
    await waitFor(() =>
      expect(
        within(entry).getByRole("switch", { name: "ICE server enabled" }),
      ).toBeChecked(),
    );
  });

  it("keeps the ICE typed fields on an explicit save, disabled until dirty", async () => {
    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });

    // Both save rules are stated in the entry, not left to be inferred.
    expect(
      within(entry).getByText(
        "Saved the moment it changes — this switch has no Save button.",
      ),
    ).toBeInTheDocument();
    expect(
      within(entry).getByText("These fields are saved with the Save button below."),
    ).toBeInTheDocument();

    const save = within(entry).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.change(within(entry).getByLabelText("TURN username"), {
      target: { value: "someone-else" },
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][1]).toMatchObject({
      username: "someone-else",
      urls: [TURN_URL],
    });
    // The switch's state is not this button's business.
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty("enabled");
  });

  it("sends a TURN entry retyped as STUN instead of refusing it in silence", async () => {
    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });
    expect(within(entry).getByLabelText("TURN username")).toHaveValue("turnuser");

    fireEvent.change(within(entry).getByLabelText("Type"), {
      target: { value: "STUN" },
    });

    // The gesture that hides these fields is the one that has to empty them.
    // Left behind, they failed a validator whose message had nowhere to render,
    // so Save returned before sending and the row simply did nothing.
    expect(
      within(entry).queryByLabelText("TURN username"),
    ).not.toBeInTheDocument();
    fireEvent.click(within(entry).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][0]).toBe(
      "/api/admin/webphone/v1/servers/s1/ice-servers/i1",
    );
    expect(api.patch.mock.calls[0][1]).toEqual({
      kind: "STUN",
      urls: [TURN_URL],
      username: null,
    });
  });

  it("says why an entry cannot be saved when the failing field is hidden", async () => {
    // A stored STUN entry carrying a username: the read contract accepts a
    // username on any kind, so this arrives from the server already invalid.
    respondWith([
      {
        ...SERVERS[0],
        iceServers: [
          {
            id: "i1",
            kind: "STUN",
            urls: ["stun:stun.example.com:3478"],
            username: "leftover",
            credentialConfigured: false,
            enabled: true,
            sortOrder: 0,
          },
        ],
      },
      SERVERS[1],
    ]);

    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: "ICE server: stun:stun.example.com:3478",
    });

    fireEvent.change(within(entry).getByLabelText("URLs"), {
      target: { value: "stun:other.example.com:3478" },
    });
    fireEvent.click(within(entry).getByRole("button", { name: "Save" }));

    // Nothing is sent, and the row says so rather than looking inert.
    expect(await within(entry).findByRole("alert")).toHaveTextContent(
      "STUN entries carry no username or credential.",
    );
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shows a TURN credential as write-only and stored, never as a value", async () => {
    render(<WebphoneSettingsPage />);
    await openAdvanced("SIP server 1: Primary");
    const entry = await screen.findByRole("article", {
      name: `ICE server: ${TURN_URL}`,
    });

    expect(within(entry).getByText("Credential: Configured")).toBeInTheDocument();
    // "Write-only" is the distinction; the field is not disabled, so nothing
    // else on screen would carry it.
    expect(within(entry).getByText("Write-only")).toBeInTheDocument();
    const credential = within(entry).getByLabelText(
      "TURN credential (write-only)",
    );
    expect(credential).toHaveValue("");
    expect(credential).toBeEnabled();
  });

  it("hides every write control from a read-only operator", async () => {
    authMock.user.permissions = ["admin.webphone.read"];
    render(<WebphoneSettingsPage />);
    const primary = await openAdvanced("SIP server 1: Primary");

    expect(
      screen.getByText(
        "Read-only view. Changes require the admin.webphone.update permission.",
      ),
    ).toBeInTheDocument();
    expect(within(primary).getByLabelText("SIP domain")).toBeDisabled();
    expect(
      within(primary).getByRole("switch", { name: "Server enabled" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Add server" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add ICE server: Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Move earlier in the failover order: Backup",
      }),
    ).not.toBeInTheDocument();

    authMock.user.permissions = ["admin.webphone.read", "admin.webphone.update"];
  });
});
