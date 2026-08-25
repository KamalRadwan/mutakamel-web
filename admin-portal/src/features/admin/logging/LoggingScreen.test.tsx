// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveLoggingLevel,
  LoggingHistoryRow,
  LoggingOverride,
  ResourceView,
  RuntimeLogRow,
} from "./types";

const { languageMock, consoleMock, liveMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar" },
  consoleMock: {
    canRead: true,
    canUpdate: true,
    directory: {
      data: null,
      state: "EMPTY",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    } as ResourceView<LoggingOverride[]>,
    directoryDraft: {
      scope: "",
      appName: "",
      tenantId: "",
      includeExpired: false,
    },
    directoryErrors: {},
    directoryPage: 1,
    directoryLimit: 50,
    directoryHasNext: false,
    activeCount: 0,
    setDirectoryDraftField: vi.fn(),
    applyDirectoryFilters: vi.fn(() => true),
    resetDirectoryFilters: vi.fn(),
    setDirectoryPage: vi.fn(),
    setDirectoryLimit: vi.fn(),
    refreshDirectory: vi.fn(),
    history: {
      data: null,
      state: "EMPTY",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    } as ResourceView<LoggingHistoryRow[]>,
    historyDraft: {
      overrideId: "",
      action: "",
      scope: "",
      appName: "",
      tenantId: "",
    },
    historyErrors: {},
    historyLimit: 50,
    setHistoryDraftField: vi.fn(),
    applyHistoryFilters: vi.fn(() => true),
    resetHistoryFilters: vi.fn(),
    setHistoryLimit: vi.fn(),
    refreshHistory: vi.fn(),
    effective: {
      data: null,
      state: "EMPTY",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    } as ResourceView<EffectiveLoggingLevel>,
    effectiveDraft: { appName: "core-app", tenantId: "" },
    effectiveErrors: {},
    setEffectiveDraftField: vi.fn(),
    resolveEffective: vi.fn(async () => true),
    overrideDraft: {
      scope: "APP",
      appName: "core-app",
      tenantId: "",
      level: "debug",
      reason: "",
      expiresAtLocal: "2026-08-12T15:00",
    },
    overrideErrors: {},
    mutationState: "IDLE",
    mutationError: null,
    mutationCorrelationId: null,
    pendingIntent: null,
    retryIntent: null,
    setOverrideDraftField: vi.fn(),
    editOverride: vi.fn(),
    requestUpsert: vi.fn(() => true),
    requestDelete: vi.fn(() => true),
    closeConfirmation: vi.fn(),
    confirmMutation: vi.fn(),
    retryExactMutation: vi.fn(),
    reconcileUnknownMutation: vi.fn(),
    clearMutationOutcome: vi.fn(),
  },
  liveMock: {
    canLive: true,
    draft: { appName: "", tenantId: "", minLevel: "warn" },
    validationErrors: {},
    connectionState: "IDLE",
    rows: [] as RuntimeLogRow[],
    controlError: null,
    reconnectAttempt: 0,
    lastActivityAt: null,
    setDraftField: vi.fn(),
    start: vi.fn(() => true),
    stop: vi.fn(),
    retryNow: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("./useLoggingConsole", () => ({
  useLoggingConsole: () => consoleMock,
}));
vi.mock("./useLiveLogging", () => ({ useLiveLogging: () => liveMock }));

import { readLoggingOverride } from "./readers";
import { LoggingScreen } from "./LoggingScreen";
import { OVERRIDE_ROW, envelope } from "./test-fixtures";

function resetMocks() {
  languageMock.lang = "en";
  consoleMock.canRead = true;
  consoleMock.canUpdate = true;
  consoleMock.directory = {
    data: null,
    state: "EMPTY",
    error: null,
    correlationId: null,
    timestamp: null,
    isRefreshing: false,
  };
  consoleMock.history = {
    data: null,
    state: "EMPTY",
    error: null,
    correlationId: null,
    timestamp: null,
    isRefreshing: false,
  };
  consoleMock.mutationState = "IDLE";
  consoleMock.pendingIntent = null;
  consoleMock.requestUpsert.mockClear();
  consoleMock.requestDelete.mockClear();
  consoleMock.applyDirectoryFilters.mockClear();
  consoleMock.applyHistoryFilters.mockClear();
  consoleMock.resolveEffective.mockClear();
  liveMock.canLive = true;
  liveMock.connectionState = "IDLE";
  liveMock.rows = [];
  liveMock.start.mockClear();
}

describe("LoggingScreen", () => {
  beforeEach(resetMocks);

  it("renders all six route capabilities and reaches their controls", () => {
    consoleMock.directory = {
      data: [readLoggingOverride(envelope(OVERRIDE_ROW)).data],
      state: "READY",
      error: null,
      correlationId: "019f1000-0000-7000-8000-000000000005",
      timestamp: "2026-08-12T12:31:00.000Z",
      isRefreshing: false,
    };
    render(<LoggingScreen />);

    expect(screen.getByRole("heading", { name: "Runtime logging" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Override directory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Effective-level inspector" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Append-only history" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Live sanitized logs" })).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Resolve effective level" }));
    fireEvent.click(screen.getByRole("button", { name: "Review and save" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Start stream" }));

    expect(consoleMock.applyDirectoryFilters).toHaveBeenCalledOnce();
    expect(consoleMock.applyHistoryFilters).toHaveBeenCalledOnce();
    expect(consoleMock.resolveEffective).toHaveBeenCalledOnce();
    expect(consoleMock.requestUpsert).toHaveBeenCalledOnce();
    expect(consoleMock.requestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: OVERRIDE_ROW.id }),
    );
    expect(liveMock.start).toHaveBeenCalledOnce();
  });

  it("fails closed for a read-forbidden operator", () => {
    consoleMock.canRead = false;
    consoleMock.directory.state = "FORBIDDEN";
    render(<LoggingScreen />);

    expect(screen.getByText("Required permission: admin.logging.read")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Override directory" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start stream" })).toBeNull();
  });

  it("keeps write and live critical permissions distinct", () => {
    consoleMock.canUpdate = false;
    liveMock.canLive = false;
    render(<LoggingScreen />);

    expect(screen.getByText(/admin\.logging\.update \+ admin\.logging\.critical/u)).toBeTruthy();
    expect(screen.getByText(/admin\.logging\.read \+ admin\.logging\.critical/u)).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Review and save",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Start stream" })).toBeNull();
  });

  it("uses feature-local Arabic copy", () => {
    languageMock.lang = "ar";
    render(<LoggingScreen />);

    expect(screen.getByRole("heading", { name: "سجلات التشغيل" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "دليل التجاوزات" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "السجلات المباشرة المنقحة" })).toBeTruthy();
  });
});
