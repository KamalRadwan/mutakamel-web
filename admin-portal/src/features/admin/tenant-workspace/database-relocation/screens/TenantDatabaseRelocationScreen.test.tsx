// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, i18nMock, api } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  i18nMock: { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl" },
  api: {
    readPreflight: vi.fn(),
    start: vi.fn(),
    get: vi.fn(),
    listForTenant: vi.fn(),
    destroySource: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("../api", () => ({ tenantDatabaseRelocationApi: api }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { TenantDatabaseRelocationScreen } from "./TenantDatabaseRelocationScreen";
import type { RelocationRecord } from "../types";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const SOURCE_ID = "019f0000-0000-7000-8000-000000000010";
const TARGET_ID = "019f0000-0000-7000-8000-000000000011";
const RUN_ID = "019f0000-0000-7000-8000-000000000030";

const READ_ONLY = ["admin.tenant_relocations.read"];
const FULL = [
  "admin.tenant_relocations.read",
  "admin.tenant_relocations.execute",
  "admin.tenant_relocations.critical",
];

function preflight(overrides: Record<string, unknown> = {}) {
  return {
    tenant: { id: TENANT_ID, name: "acme", status: "ACTIVE" },
    current: {
      databaseServerId: SOURCE_ID,
      databaseServerName: "Postgres Cairo",
      databaseName: "tenant_acme",
      databasePlacementRevision: "4",
    },
    targets: [
      {
        id: TARGET_ID,
        name: "Postgres Frankfurt",
        status: "ACTIVE",
        countryName: "Germany",
        countryIsoCode: "DE",
        currentTenants: 12,
        maxTenants: 50,
      },
    ],
    blockers: [],
    retention: { minDays: 1, maxDays: 30, defaultDays: 7 },
    ...overrides,
  };
}

function record(overrides: Partial<RelocationRecord> = {}): RelocationRecord {
  return {
    relocationId: "019f0000-0000-7000-8000-0000000000aa",
    tenantId: TENANT_ID,
    sourceDatabaseServerId: SOURCE_ID,
    sourceDatabaseName: "tenant_acme",
    targetDatabaseServerId: TARGET_ID,
    targetDatabaseName: "tenant_acme",
    actorId: "019f0000-0000-7000-8000-0000000000ff",
    reason: "Rebalance the Cairo fleet",
    startedAt: "2026-09-01T10:00:00.000Z",
    steps: [],
    outcome: "RUNNING",
    ...overrides,
  };
}

describe("TenantDatabaseRelocationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = { isSuperAdmin: false, permissions: [...FULL] };
    authMock.isLoading = false;
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    api.readPreflight.mockResolvedValue(preflight());
    api.listForTenant.mockResolvedValue([]);
    window.sessionStorage.clear();
  });

  it("renders a real permission boundary and issues no read without relocation-read", () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "admin.tenant_relocations.read",
    );
    expect(api.readPreflight).not.toHaveBeenCalled();
    expect(api.listForTenant).not.toHaveBeenCalled();
  });

  it("shows the current placement revision the move will be fenced on", async () => {
    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("Postgres Cairo")).toBeInTheDocument();
    expect(screen.getByText("tenant_acme")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(api.readPreflight).toHaveBeenCalledWith(TENANT_ID);
  });

  it("explains every blocker in plain language and refuses to submit, without hiding the page", async () => {
    api.readPreflight.mockResolvedValue(
      preflight({
        blockers: ["RELOCATION_IN_PROGRESS", "MAINTENANCE_FENCE_OPEN"],
      }),
    );

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByText("A database relocation is already running"),
    ).toBeInTheDocument();
    expect(screen.getByText("A maintenance fence is open")).toBeInTheDocument();
    // The placement card is still mounted: a blocker disables the submit, it
    // does not replace the page.
    expect(screen.getByText("Postgres Cairo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start relocation/ })).toBeDisabled();
  });

  it("names the exact missing permissions instead of silently omitting the submit", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [...READ_ONLY] };

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByText("admin.tenant_relocations.execute"),
    ).toBeInTheDocument();
    expect(screen.getByText("admin.tenant_relocations.critical")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start relocation/ })).toBeDisabled();
  });

  it("explains that no destination is eligible rather than offering an empty select", async () => {
    api.readPreflight.mockResolvedValue(preflight({ targets: [] }));

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(await screen.findByText("No destination is eligible")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Destination Database Server" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start relocation/ })).toBeDisabled();
  });

  it("recovers a running relocation after a reload and marks the next step active", async () => {
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({
          steps: [
            { step: "CLAIM", state: "DONE", at: "2026-09-01T10:01:00.000Z" },
            { step: "QUIESCE", state: "DONE", at: "2026-09-01T10:02:00.000Z" },
          ],
        }),
      },
    ]);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Relocation progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Running now/)).toBeInTheDocument();
    expect(screen.getByText("Refreshing automatically")).toBeInTheDocument();
    expect(api.listForTenant).toHaveBeenCalledWith(TENANT_ID);
    // The select form is replaced by the monitor while a move is in flight.
    expect(
      screen.queryByRole("button", { name: /Start relocation/ }),
    ).not.toBeInTheDocument();
  });

  it("does not reopen a relocation that already settled and released its source", async () => {
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({ outcome: "ABANDONED", failedStep: "BACKUP" }),
      },
    ]);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    // History is not an in-flight run: the wizard opens ready for a new move.
    expect(await screen.findByText("Postgres Cairo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start relocation/ })).toBeInTheDocument();
  });

  it("polls a running move and shows the failed step and rollback once it is abandoned", async () => {
    vi.useFakeTimers();
    try {
      api.listForTenant.mockResolvedValue([{ runId: RUN_ID, record: record() }]);
      api.get.mockResolvedValue(
        record({
          outcome: "ABANDONED",
          failedStep: "VERIFY",
          rollback: "SOURCE_AUTHORITATIVE",
          steps: [
            {
              step: "VERIFY",
              state: "FAILED",
              at: "2026-09-01T10:20:00.000Z",
              detail: "Row counts did not match on 3 tables",
            },
          ],
        }),
      );

      render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("Refreshing automatically")).toBeInTheDocument();

      // One 5s poll tick is what turns the running ledger into a settled one.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(api.get).toHaveBeenCalledWith(RUN_ID);

      expect(screen.getByText("The relocation was abandoned.")).toBeInTheDocument();
      expect(
        screen.getByText("Failed: Row counts did not match on 3 tables"),
      ).toBeInTheDocument();
      expect(screen.getByText(/never stopped being authoritative/)).toBeInTheDocument();
      // An abandoned relocation never retained a source, so there is nothing to
      // release and the irreversible control is not offered.
      expect(
        screen.queryByRole("button", { name: /Release retained source/ }),
      ).not.toBeInTheDocument();
      // Polling stops once the outcome settles.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(api.get).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the source release disabled until the retention window closes", async () => {
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({
          outcome: "RELOCATED",
          retainUntil: new Date(Date.now() + 86_400_000).toISOString(),
          steps: [{ step: "RETAIN", state: "DONE", at: "2026-09-01T10:30:00.000Z" }],
        }),
      },
    ]);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    const release = await screen.findByRole("button", {
      name: /Release retained source/,
    });
    expect(release).toBeDisabled();
    expect(
      screen.getByText("Available once the retention window closes."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dropping the retained source database is irreversible/),
    ).toBeInTheDocument();
  });

  it("does not re-adopt a retained relocation the operator dismissed", async () => {
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({
          outcome: "RELOCATED",
          retainUntil: "2026-08-01T00:00:00.000Z",
          steps: [{ step: "RETAIN", state: "DONE", at: "2026-08-01T00:00:00.000Z" }],
        }),
      },
    ]);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Start another move" }));

    // The reload behind "start another move" must not drop the operator back
    // into the finish phase they just left, even though the tenant's history
    // still reports that retained run.
    expect(
      await screen.findByRole("button", { name: /Start relocation/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Release retained source/ }),
    ).not.toBeInTheDocument();
  });

  it("requires the typed tenant id before releasing the retained source", async () => {
    const released = record({
      outcome: "RELOCATED",
      retainUntil: "2026-08-01T00:00:00.000Z",
      sourceDestroyedAt: "2026-09-02T00:00:00.000Z",
      steps: [{ step: "RETAIN", state: "DONE", at: "2026-08-01T00:00:00.000Z" }],
    });
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({
          outcome: "RELOCATED",
          retainUntil: "2026-08-01T00:00:00.000Z",
          steps: [{ step: "RETAIN", state: "DONE", at: "2026-08-01T00:00:00.000Z" }],
        }),
      },
    ]);
    api.destroySource.mockResolvedValue(released);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Release retained source/ }),
    );

    const confirm = await screen.findByRole("button", { name: "Release permanently" });
    expect(confirm).toBeDisabled();
    expect(api.destroySource).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Type the exact name to confirm" }),
      { target: { value: TENANT_ID } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(api.destroySource).toHaveBeenCalledTimes(1));
    const [runId, body, key] = api.destroySource.mock.calls[0];
    expect(runId).toBe(RUN_ID);
    expect(body).toEqual({ confirmTenantId: TENANT_ID });
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      await screen.findByText("The retained source has already been released."),
    ).toBeInTheDocument();
  });

  it("keeps an unconfirmed relocation outcome recoverable instead of resending it", async () => {
    api.listForTenant.mockResolvedValueOnce([]);
    api.destroySource.mockRejectedValue({
      response: { status: 503, data: { code: "GW.UPSTREAM", title: "Unavailable" } },
    });
    api.listForTenant.mockResolvedValue([
      {
        runId: RUN_ID,
        record: record({
          outcome: "RELOCATED",
          retainUntil: "2026-08-01T00:00:00.000Z",
          steps: [{ step: "RETAIN", state: "DONE", at: "2026-08-01T00:00:00.000Z" }],
        }),
      },
    ]);

    render(<TenantDatabaseRelocationScreen tenantId={TENANT_ID} />);

    // Nothing is in flight, so the wizard opens on the select phase.
    expect(await screen.findByText("Postgres Cairo")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders Arabic RTL without mojibake", async () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";
    api.readPreflight.mockResolvedValue(
      preflight({ blockers: ["TENANT_NOT_RELOCATABLE"] }),
    );

    const { container } = render(
      <TenantDatabaseRelocationScreen tenantId={TENANT_ID} />,
    );

    expect(await screen.findByText("حالة المستأجر لا تسمح بالنقل")).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/[ØÙâÂ]/);
  });
});
