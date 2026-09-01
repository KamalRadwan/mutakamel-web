// @vitest-environment jsdom

import { useMemo, useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  unwrapCoreData: <T,>(payload: unknown): T => {
    const record = payload as { data?: unknown };
    return (record.data ?? payload) as T;
  },
}));

import {
  isUnsupportedQueryError,
  mergeDashboardGroups,
  rangeSignature,
  requestedGroupsForTab,
  useDashboardData,
} from "./useDashboardData";

const DASHBOARD_FIXTURE = {
  asOf: "2026-08-29T04:00:00.000Z",
  authorizedGroups: [],
  range: {
    from: "2026-08-01",
    to: "2026-08-29",
    label: "This month",
    granularity: "day",
  },
  loadedGroups: [],
  overview: {},
} as unknown as DashboardResponse;

function DashboardPollingHarness() {
  const headerRegionRef = useRef<HTMLDivElement>(null);
  const dataRegionRef = useRef<HTMLDivElement>(null);
  const ownedRefreshRegionRefs = useMemo(
    () => [headerRegionRef, dataRegionRef],
    [],
  );
  const dashboard = useDashboardData({ ownedRefreshRegionRefs });

  return (
    <div>
      <div ref={headerRegionRef}>
        <label>
          Dashboard date
          <input />
        </label>
      </div>
      <div ref={dataRegionRef}>
        <button type="button">Owned dashboard action</button>
        <button type="button">Overview tab</button>
      </div>
      <button
        type="button"
        onClick={() => dashboard.setAutoRefreshInterval("30s")}
      >
        Enable auto-refresh
      </button>
      <button
        type="button"
        onClick={() => dashboard.setOperatorRefreshPaused(true)}
      >
        Pause explicitly
      </button>
      <button
        type="button"
        onClick={() => dashboard.setOperatorRefreshPaused(false)}
      >
        Resume explicitly
      </button>
      <button type="button">Outside action</button>
      <button type="button" onClick={dashboard.handleRefresh}>
        Refresh dashboard
      </button>
      <button type="button" onClick={() => dashboard.setActiveTab("storage")}>
        Open storage tab
      </button>
      <output data-testid="refresh-paused">
        {String(dashboard.isAutoRefreshPaused)}
      </output>
      <output data-testid="dashboard-as-of">
        {dashboard.data?.asOf ?? "not-loaded"}
      </output>
    </div>
  );
}

// Two distinct windows; the ordering test only needs them to differ.
const LAST_MONTH = {
  from: new Date("2026-08-01T00:00:00.000Z"),
  to: new Date("2026-08-31T23:59:59.999Z"),
};
const THIS_MONTH = {
  from: new Date("2026-09-01T00:00:00.000Z"),
  to: new Date("2026-09-30T23:59:59.999Z"),
};

function DashboardRequestOrderingHarness() {
  const dashboard = useDashboardData();

  return (
    <div>
      <button
        type="button"
        onClick={() => dashboard.setRange(LAST_MONTH)}
      >
        Show last month
      </button>
      <button
        type="button"
        onClick={() => dashboard.setRange({ ...LAST_MONTH })}
      >
        Keep this month
      </button>
      <button type="button" onClick={dashboard.handleRefresh}>
        Refresh now
      </button>
      <output data-testid="ordered-dashboard-as-of">
        {dashboard.data?.asOf ?? "not-loaded"}
      </output>
      <output data-testid="ordered-dashboard-error">
        {dashboard.error?.message ?? "no-error"}
      </output>
      <output data-testid="ordered-dashboard-pending">
        {String(dashboard.isLoading || dashboard.isRefreshing)}
      </output>
    </div>
  );
}

describe("useDashboardData guarded polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.get.mockReset();
    api.get.mockResolvedValue({ data: DASHBOARD_FIXTURE });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves data and focus while paused, then resumes the existing cadence", async () => {
    render(<DashboardPollingHarness />);
    await advance(0);

    expect(api.get).toHaveBeenCalledOnce();
    // The overview loads every authorized group, so it sends no `groups`
    // scope — but it always carries the reporting window.
    const [url] = api.get.mock.calls[0];
    expect(url).toContain("/api/admin/core/v1/dashboard?");
    expect(url).not.toContain("groups=");
    expect(url).toContain("from=");
    expect(url).toContain("to=");
    expect(screen.getByTestId("dashboard-as-of")).toHaveTextContent(
      DASHBOARD_FIXTURE.asOf,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enable auto-refresh" }),
    );
    await focus(
      screen.getByRole("button", { name: "Owned dashboard action" }),
    );
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("false");
    await focus(screen.getByRole("button", { name: "Overview tab" }));
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("false");
    await advance(30_000);
    expect(api.get).toHaveBeenCalledTimes(2);

    const editor = screen.getByRole("textbox", { name: "Dashboard date" });
    await focus(editor);
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("true");

    await advance(30_000);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("dashboard-as-of")).toHaveTextContent(
      DASHBOARD_FIXTURE.asOf,
    );
    expect(editor).toHaveFocus();

    await focus(screen.getByRole("button", { name: "Outside action" }));
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("false");
    await advance(30_000);
    expect(api.get).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "Pause explicitly" }));
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("true");
    await advance(30_000);
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("dashboard-as-of")).toHaveTextContent(
      DASHBOARD_FIXTURE.asOf,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resume explicitly" }));
    expect(screen.getByTestId("refresh-paused")).toHaveTextContent("false");
    await advance(30_000);
    expect(api.get).toHaveBeenCalledTimes(4);
  });

  it("keeps the newer range response when an older request resolves last", async () => {
    const firstRequest = createDeferred<{ data: DashboardResponse }>();
    const secondRequest = createDeferred<{ data: DashboardResponse }>();
    const newerFixture = {
      ...DASHBOARD_FIXTURE,
      asOf: "2026-08-29T05:00:00.000Z",
    } as DashboardResponse;
    api.get
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<DashboardRequestOrderingHarness />);
    await advance(0);
    fireEvent.click(screen.getByRole("button", { name: "Show last month" }));
    await advance(0);

    await settleRequest(() => secondRequest.resolve({ data: newerFixture }));
    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      newerFixture.asOf,
    );
    expect(screen.getByTestId("ordered-dashboard-pending")).toHaveTextContent(
      "false",
    );

    await settleRequest(() =>
      firstRequest.resolve({ data: DASHBOARD_FIXTURE }),
    );
    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      newerFixture.asOf,
    );
    expect(screen.getByTestId("ordered-dashboard-error")).toHaveTextContent(
      "no-error",
    );
  });

  it("invalidates the old range before the replacement request starts", async () => {
    const firstRequest = createDeferred<{ data: DashboardResponse }>();
    const secondRequest = createDeferred<{ data: DashboardResponse }>();
    const newerFixture = {
      ...DASHBOARD_FIXTURE,
      asOf: "2026-08-29T05:30:00.000Z",
    } as DashboardResponse;
    api.get
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<DashboardRequestOrderingHarness />);
    await advance(0);
    expect(api.get).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Show last month" }));
    await settleRequest(() =>
      firstRequest.resolve({ data: DASHBOARD_FIXTURE }),
    );

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      "not-loaded",
    );

    await advance(0);
    expect(api.get).toHaveBeenCalledTimes(2);
    await settleRequest(() => secondRequest.resolve({ data: newerFixture }));
    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      newerFixture.asOf,
    );
  });

  it("does not orphan an active request when the selected range is reselected", async () => {
    api.get.mockReset().mockResolvedValue({ data: DASHBOARD_FIXTURE });

    render(<DashboardRequestOrderingHarness />);
    await advance(0);
    expect(api.get).toHaveBeenCalledTimes(1);

    // Choosing a different window fetches once.
    fireEvent.click(screen.getByRole("button", { name: "Show last month" }));
    await advance(0);
    expect(api.get).toHaveBeenCalledTimes(2);

    // Reselecting the same window — a fresh object carrying the same
    // instants — must not fetch again, or every click of an already-active
    // preset would orphan the request in flight.
    fireEvent.click(screen.getByRole("button", { name: "Keep this month" }));
    await advance(0);

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("ordered-dashboard-pending")).toHaveTextContent(
      "false",
    );
    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      DASHBOARD_FIXTURE.asOf,
    );
  });

  it("ignores an older failure after the latest range request succeeds", async () => {
    const firstRequest = createDeferred<{ data: DashboardResponse }>();
    const secondRequest = createDeferred<{ data: DashboardResponse }>();
    const newerFixture = {
      ...DASHBOARD_FIXTURE,
      asOf: "2026-08-29T06:00:00.000Z",
    } as DashboardResponse;
    api.get
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<DashboardRequestOrderingHarness />);
    await advance(0);
    fireEvent.click(screen.getByRole("button", { name: "Show last month" }));
    await advance(0);

    await settleRequest(() => secondRequest.resolve({ data: newerFixture }));
    await settleRequest(() =>
      firstRequest.reject(new Error("stale dashboard failure")),
    );

    expect(screen.getByTestId("ordered-dashboard-as-of")).toHaveTextContent(
      newerFixture.asOf,
    );
    expect(screen.getByTestId("ordered-dashboard-error")).toHaveTextContent(
      "no-error",
    );
    expect(screen.getByTestId("ordered-dashboard-pending")).toHaveTextContent(
      "false",
    );
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function settleRequest(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function focus(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.focus();
    await Promise.resolve();
  });
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe("per-tab group scoping", () => {
  it("scopes a group tab, and leaves the overview unscoped", () => {
    expect(requestedGroupsForTab("storage")).toEqual(["storage"]);
    // The overview's report-group grid summarises every authorized group,
    // so scoping it would leave most of that grid blank.
    expect(requestedGroupsForTab("overview")).toEqual([]);
  });

  it("distinguishes reporting windows so a stale group is never carried", () => {
    expect(rangeSignature({})).toBe(rangeSignature({}));
    expect(rangeSignature({ from: "2026-01-01" })).not.toBe(
      rangeSignature({ from: "2026-02-01" }),
    );
  });

  describe("mergeDashboardGroups", () => {
    const previous = {
      asOf: "a",
      authorizedGroups: ["tenants", "storage"],
      loadedGroups: ["tenants", "storage"],
      tenants: { key: "tenants", available: true },
      storage: { key: "storage", available: true },
    } as unknown as DashboardResponse;

    const next = {
      asOf: "b",
      authorizedGroups: ["tenants", "storage"],
      loadedGroups: ["storage"],
      storage: { key: "storage", available: true, asOf: "b" },
    } as unknown as DashboardResponse;

    it("keeps groups the new response did not carry, within one window", () => {
      const merged = mergeDashboardGroups(previous, next, true);
      expect(merged.tenants).toBe(previous.tenants);
      expect(merged.storage).toBe(next.storage);
      expect(merged.asOf).toBe("b");
    });

    it("drops everything when the reporting window changed", () => {
      const merged = mergeDashboardGroups(previous, next, false);
      expect(merged.tenants).toBeUndefined();
      expect(merged).toBe(next);
    });

    it("has nothing to carry on the first response", () => {
      expect(mergeDashboardGroups(null, next, true)).toBe(next);
    });
  });
});

describe("Core that predates the groups parameter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.get.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a 400 as an unsupported query, and nothing else", () => {
    expect(isUnsupportedQueryError({ response: { status: 400 } })).toBe(true);
    expect(isUnsupportedQueryError({ response: { status: 403 } })).toBe(false);
    expect(isUnsupportedQueryError({ response: { status: 500 } })).toBe(false);
    expect(isUnsupportedQueryError(new Error("network"))).toBe(false);
  });

  it("retries unscoped and keeps working when Core rejects ?groups=", async () => {
    // Core's global pipe sets forbidNonWhitelisted, so an older deployment
    // 400s the whole request rather than ignoring the unknown parameter.
    const rejection = Object.assign(new Error("Bad Request"), {
      response: { status: 400, data: { code: "COMMON.GENERIC.VALIDATION_FAILED" } },
    });
    api.get
      .mockResolvedValueOnce({ data: { data: DASHBOARD_FIXTURE } })
      .mockRejectedValueOnce(rejection)
      .mockResolvedValue({
        data: { data: { ...DASHBOARD_FIXTURE, loadedGroups: undefined } },
      });

    render(<DashboardPollingHarness />);
    await advance(0);
    api.get.mockClear();

    // Only a group tab sends a scope, so that is where the 400 appears.
    fireEvent.click(screen.getByRole("button", { name: "Open storage tab" }));
    await advance(0);

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get.mock.calls[0][0]).toContain("groups=storage");
    expect(api.get.mock.calls[1][0]).not.toContain("groups=");
    // The operator sees data, not the validation error.
    expect(screen.getByTestId("dashboard-as-of")).toHaveTextContent(
      DASHBOARD_FIXTURE.asOf,
    );
  });

  it("stops sending the parameter for the rest of the session", async () => {
    const rejection = Object.assign(new Error("Bad Request"), {
      response: { status: 400 },
    });
    api.get
      .mockResolvedValueOnce({ data: { data: DASHBOARD_FIXTURE } })
      .mockRejectedValueOnce(rejection)
      .mockResolvedValue({ data: { data: DASHBOARD_FIXTURE } });

    render(<DashboardPollingHarness />);
    await advance(0);
    fireEvent.click(screen.getByRole("button", { name: "Open storage tab" }));
    await advance(0);
    api.get.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await advance(0);

    expect(api.get).toHaveBeenCalled();
    for (const [url] of api.get.mock.calls) {
      expect(url).not.toContain("groups=");
    }
  });

  it("does not swallow a genuine failure", async () => {
    api.get.mockRejectedValue(
      Object.assign(new Error("boom"), { response: { status: 500 } }),
    );

    render(<DashboardPollingHarness />);
    await advance(0);

    // One attempt only: a 500 is not a missing-parameter signal.
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
