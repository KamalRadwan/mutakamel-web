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
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
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
    viewMock.performBulkAction.mockResolvedValue(1);
    viewMock.performItemAction.mockResolvedValue(undefined);
    viewMock.savePreference.mockResolvedValue(preferenceFixture());
  });

  it("exposes one control per supported notification action", () => {
    render(<AdminNotificationsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Read all (canonical)" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(viewMock.performBulkAction).toHaveBeenNthCalledWith(1, "read-all");
    expect(viewMock.performBulkAction).toHaveBeenCalledTimes(1);
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "read");
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "acknowledge");
    expect(viewMock.performItemAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /alias|compatibility/i })).not.toBeInTheDocument();
  });

  it("confirmation-gates recipient dismissal", () => {
    render(<AdminNotificationsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(viewMock.performItemAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(viewMock.performItemAction).toHaveBeenCalledWith(ID, "dismiss");

    expect(viewMock.performItemAction).toHaveBeenCalledTimes(1);
  });

  it("saves only an in-app preference and omits retired controls", async () => {
    render(<AdminNotificationsScreen />);

    fireEvent.change(screen.getByLabelText("Notification type"), {
      target: { value: " tenant.billing.overdue " },
    });
    fireEvent.click(screen.getByRole("switch", { name: "In-app" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
    await waitFor(() => expect(viewMock.savePreference).toHaveBeenCalledWith({
      notificationType: "tenant.billing.overdue",
      inAppEnabled: false,
    }));

    expect(screen.queryByLabelText("Quiet-hours JSON object")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Push" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.queryByText("Push device token")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Provider token")).not.toBeInTheDocument();
    expect(screen.getByText("30000 ms")).toBeInTheDocument();
  });

  it("loads an existing in-app preference into the editor", async () => {
    viewMock.preferences = [{ ...preferenceFixture(), inAppEnabled: false }];
    render(<AdminNotificationsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Notification type")).toHaveValue("tenant.user.invited");
    expect(screen.getByRole("switch", { name: "In-app" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
    await waitFor(() => expect(viewMock.savePreference).toHaveBeenCalledWith({
      notificationType: "tenant.user.invited", inAppEnabled: false,
    }));
  });

  it("hides preference writes for read-only operators", () => {
    viewMock.canManage = false;
    render(<AdminNotificationsScreen />);
    expect(screen.queryByRole("button", { name: "Save preference" })).not.toBeInTheDocument();
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
    previewLimit: 10,
    pollIntervalMs: 30_000,
  };
}

function preferenceFixture() {
  return {
    notificationType: "tenant.user.invited",
    inAppEnabled: true,
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}
