// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { stateMock, toastMock } = vi.hoisted(() => ({
  stateMock: {
    lang: "en" as "ar" | "en",
    snapshot: {
      data: {
        enabled: false,
        configured: false,
        brokerConfigured: false,
        updatedAt: null as string | null,
      },
      correlationId: "corr-storage-runtime",
      timestamp: "2026-08-25T03:00:00.000Z",
    },
    loadState: "READY" as const,
    loadError: null,
    mutation: {
      action: null as null | "ENABLE" | "DISABLE" | "GENERATE_KEY" | "ROTATE_KEY",
      phase: "IDLE" as "IDLE" | "PENDING" | "SUCCEEDED" | "FAILED",
      error: null,
      localCode: null,
    },
    canUpdateCritical: true,
    setEnabled: vi.fn(),
    rotateKey: vi.fn(),
    refetch: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./hooks/useStorageRuntimeSettings", () => ({
  useStorageRuntimeSettings: () => stateMock,
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: stateMock.lang }),
}));

import StorageRuntimeSettingsPage from "./page";

describe("StorageRuntimeSettingsPage", () => {
  beforeEach(() => {
    stateMock.lang = "en";
    stateMock.snapshot.data = {
      enabled: false,
      configured: false,
      brokerConfigured: false,
      updatedAt: null,
    };
    stateMock.mutation = {
      action: null,
      phase: "IDLE",
      error: null,
      localCode: null,
    };
    stateMock.canUpdateCritical = true;
    stateMock.setEnabled.mockReset().mockResolvedValue(true);
    stateMock.rotateKey.mockReset().mockResolvedValue(true);
    stateMock.refetch.mockReset();
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

  it("shows only the four secret-free Core evidence fields", () => {
    render(<StorageRuntimeSettingsPage />);
    const region = screen.getByRole("region", {
      name: "Storage runtime status",
    });

    expect(within(region).getAllByRole("term")).toHaveLength(4);
    expect(within(region).getByText("Runtime")).toBeInTheDocument();
    expect(within(region).getByText("Key configuration")).toBeInTheDocument();
    expect(within(region).getByText("Broker readiness")).toBeInTheDocument();
    expect(within(region).getByText("Updated")).toBeInTheDocument();
    expect(region.textContent).not.toMatch(/master|cipher|revision|generation/i);
  });

  it("blocks enablement until a key is configured and confirmation-gates generation", async () => {
    render(<StorageRuntimeSettingsPage />);

    expect(
      screen.getByRole("switch", { name: "Enable storage runtime" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate encryption key" }),
    );

    expect(stateMock.rotateKey).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "Generate the storage encryption key?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate key" }));

    await waitFor(() => expect(stateMock.rotateKey).toHaveBeenCalledTimes(1));
  });

  it("allows an authorized configured runtime switch and rotation action", async () => {
    stateMock.snapshot.data = {
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: "2026-08-25T03:00:00.000Z",
    };
    render(<StorageRuntimeSettingsPage />);

    fireEvent.click(
      screen.getByRole("switch", { name: "Enable storage runtime" }),
    );
    await waitFor(() => expect(stateMock.setEnabled).toHaveBeenCalledWith(true));
    fireEvent.click(
      screen.getByRole("button", { name: "Rotate encryption key" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Rotate the storage encryption key?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate key" }));
    await waitFor(() => expect(stateMock.rotateKey).toHaveBeenCalledTimes(1));
  });

  it("warns about broker drift and prevents only a new enable action", async () => {
    stateMock.snapshot.data = {
      enabled: false,
      configured: true,
      brokerConfigured: false,
      updatedAt: "2026-08-25T03:00:00.000Z",
    };
    const { rerender } = render(<StorageRuntimeSettingsPage />);

    expect(
      screen.getByRole("switch", { name: "Enable storage runtime" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/broker authentication is not fully configured/i),
    ).toBeInTheDocument();
    expect(stateMock.setEnabled).not.toHaveBeenCalled();

    stateMock.snapshot.data = {
      ...stateMock.snapshot.data,
      enabled: true,
    };
    rerender(<StorageRuntimeSettingsPage />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Enable storage runtime" }),
    );
    await waitFor(() =>
      expect(stateMock.setEnabled).toHaveBeenCalledWith(false),
    );
  });

  it("keeps controls read-only without the full critical permission pair", () => {
    stateMock.snapshot.data = {
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: "2026-08-25T03:00:00.000Z",
    };
    stateMock.canUpdateCritical = false;
    render(<StorageRuntimeSettingsPage />);

    expect(
      screen.getByRole("switch", { name: "Enable storage runtime" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Rotate encryption key" }),
    ).toBeNull();
    expect(screen.getByText(/require both admin.settings.update/)).toBeTruthy();
  });

  it("renders the Arabic RTL-ready copy from the selected locale", () => {
    stateMock.lang = "ar";
    render(<StorageRuntimeSettingsPage />);

    expect(
      screen.getByRole("heading", { name: "تشغيل التخزين" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "تفعيل تشغيل التخزين" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "إنشاء مفتاح التشفير" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/تهيئة مصادقة وسيط رسائل تشغيل التخزين غير مكتملة/),
    ).toBeInTheDocument();
  });
});
