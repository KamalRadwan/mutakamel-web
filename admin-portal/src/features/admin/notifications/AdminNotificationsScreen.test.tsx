// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { viewMock } = vi.hoisted(() => ({
  viewMock: {
    canRead: true,
    canManage: true,
    requestState: "READY",
    page: null as ReturnType<typeof pageFixture> | null,
    config: null as ReturnType<typeof runtimeFixture> | null,
    preferences: [] as ReturnType<typeof preferenceFixture>[],
    unreadCount: 1,
    loadError: null,
    limit: 20,
    setLimit: vi.fn(),
    unreadOnly: false,
    setUnreadOnly: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    isLoadingMore: false,
    actionStatus: {
      state: "IDLE",
      operation: null,
      messageKey: null,
      error: null,
    },
    lastUpdatedCount: null,
    clearActionStatus: vi.fn(),
    retryLastAction: vi.fn(),
    performItemAction: vi.fn(),
    performBulkAction: vi.fn(),
    savePreference: vi.fn(),
    registerDevice: vi.fn(),
    revokeDevice: vi.fn(),
    deviceReceipt: null,
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <nav /> }));
vi.mock("@/components/shared/DestructiveActionModal", () => ({
  DestructiveActionModal: ({
    isOpen,
    onConfirm,
    title,
    confirmLabel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
    confirmLabel: string;
  }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <button type="button" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ) : null,
}));
vi.mock("./useAdminNotifications", () => ({
  useAdminNotifications: () => viewMock,
}));

import { AdminNotificationsScreen } from "./AdminNotificationsScreen";

const ID = "019f0000-0000-7000-8000-000000000001";
const DEVICE_ID = "019f0000-0000-7000-8000-000000000003";

describe("AdminNotificationsScreen", () => {
  beforeEach(() => {
    for (const value of Object.values(viewMock)) {
      if (typeof value === "function" && "mockReset" in value) value.mockReset();
    }
    viewMock.canRead = true;
    viewMock.canManage = true;
    viewMock.requestState = "READY";
    viewMock.page = pageFixture();
    viewMock.config = runtimeFixture();
    viewMock.preferences = [preferenceFixture()];
    viewMock.unreadCount = 1;
    viewMock.loadError = null;
    viewMock.limit = 20;
    viewMock.unreadOnly = false;
    viewMock.isLoadingMore = false;
    viewMock.actionStatus = {
      state: "IDLE",
      operation: null,
      messageKey: null,
      error: null,
    };
    viewMock.lastUpdatedCount = null;
    viewMock.deviceReceipt = null;
    viewMock.performBulkAction.mockResolvedValue(1);
    viewMock.performItemAction.mockResolvedValue(undefined);
    viewMock.savePreference.mockResolvedValue(preferenceFixture());
    viewMock.registerDevice.mockResolvedValue(deviceReceiptFixture());
    viewMock.revokeDevice.mockResolvedValue(undefined);
  });

  it("makes canonical and compatibility notification actions reachable", () => {
    render(<AdminNotificationsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Read all (canonical)" }));
    fireEvent.click(screen.getByRole("button", {
      name: "Mark all read (compatibility alias)",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge via /ack alias" }));

    expect(viewMock.performBulkAction).toHaveBeenNthCalledWith(1, "read-all");
    expect(viewMock.performBulkAction).toHaveBeenNthCalledWith(
      2,
      "mark-all-read-compatibility",
    );
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "read");
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "acknowledge");
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "ack-compatibility");
  });

  it("confirmation-gates both recipient-dismiss routes", () => {
    render(<AdminNotificationsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(viewMock.performItemAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "dismiss");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss via POST alias" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(viewMock.performItemAction).toHaveBeenCalledWith(
      ID,
      "dismiss-post-compatibility",
    );
  });

  it("validates and sends exact preference and device-token DTOs", async () => {
    render(<AdminNotificationsScreen />);

    fireEvent.change(screen.getByLabelText("Notification type"), {
      target: { value: " tenant.billing.overdue " },
    });
    fireEvent.change(screen.getByLabelText("Quiet-hours JSON object"), {
      target: { value: '{"from":"22:00"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
    await waitFor(() => expect(viewMock.savePreference).toHaveBeenCalledWith({
      notificationType: "tenant.billing.overdue",
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: false,
      quietHours: { from: "22:00" },
    }));

    fireEvent.change(screen.getByLabelText("Provider token"), {
      target: { value: "opaque-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register or refresh token" }));
    await waitFor(() => expect(viewMock.registerDevice).toHaveBeenCalledWith({
      provider: "web-push",
      token: "opaque-token",
      platform: "web",
      enabled: true,
    }));
    await waitFor(() => expect(screen.getByLabelText("Provider token")).toHaveValue(""));
  });

  it("rejects a stale device id locally and confirmation-gates a valid revoke", () => {
    render(<AdminNotificationsScreen />);

    fireEvent.change(screen.getByLabelText("Device token UUIDv7"), {
      target: { value: "00000000-0000-4000-8000-000000000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revoke device token" }));
    expect(screen.getByText("Enter a canonical UUIDv7.")).toBeInTheDocument();
    expect(viewMock.revokeDevice).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Device token UUIDv7"), {
      target: { value: DEVICE_ID },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revoke device token" }));
    expect(viewMock.revokeDevice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(viewMock.revokeDevice).toHaveBeenCalledWith(DEVICE_ID);
  });
});

function pageFixture() {
  return {
    items: [{
      id: ID,
      sourceApp: "core-app",
      notificationType: "tenant.user.invited",
      priority: "P2_NORMAL",
      title: "Invitation sent",
      body: "The tenant invitation was sent.",
      actionUrl: "/tenants/019f0000-0000-7000-8000-000000000002",
      entityType: "tenant",
      entityId: "019f0000-0000-7000-8000-000000000002",
      channels: ["IN_APP"],
      metadata: {},
      createdAt: "2026-08-12T10:00:00.000Z",
      readAt: null,
      acknowledgedAt: null,
      deliveredAt: null,
    }],
    unreadCount: 1,
    nextCursor: null,
    hasNext: false,
  };
}

function runtimeFixture() {
  return {
    enabled: true,
    inAppEnabled: true,
    realtimeEnabled: false,
    pushEnabled: false,
    emailEnabled: true,
    provider: "none",
    previewLimit: 10,
    pollIntervalMs: 30_000,
    firebase: {
      apiKey: "",
      appId: "",
      authDomain: "",
      projectId: "",
      messagingSenderId: "",
      storageBucket: "",
      measurementId: "",
      webPushVapidPublicKey: "",
      messagingServiceWorkerPath: "/firebase-messaging-sw.js",
      messagingServiceWorkerScope: "/",
    },
  };
}

function preferenceFixture() {
  return {
    notificationType: "tenant.user.invited",
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: true,
    quietHours: {},
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}

function deviceReceiptFixture() {
  return {
    id: DEVICE_ID,
    provider: "web-push",
    tokenHash: "d".repeat(64),
    deviceId: null,
    platform: "web",
    enabled: true,
    lastSeenAt: "2026-08-12T10:00:00.000Z",
    revokedAt: null,
  };
}
