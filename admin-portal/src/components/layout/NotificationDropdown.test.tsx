// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNotificationsCopy } from "@/features/admin/notifications/copy";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

const { hookMock } = vi.hoisted(() => ({
  hookMock: {
    copy: null as unknown as ReturnType<typeof getNotificationsCopy>,
    dir: "ltr" as "ltr" | "rtl",
    canRead: true,
    canManage: true,
    isOpen: true,
    unreadCount: 1,
    notifications: [] as ReturnType<typeof notificationFixture>[],
    loadState: "READY",
    loadError: null as NormalizedApiError | null,
    actionState: "IDLE",
    actionError: null as NormalizedApiError | null,
    isPending: false,
    toggleOpen: vi.fn(),
    close: vi.fn(),
    markAllRead: vi.fn(),
    markRead: vi.fn(),
    acknowledge: vi.fn(),
  },
}));

vi.mock("./hooks/useNotificationDropdown", () => ({
  useNotificationDropdown: () => hookMock,
}));

import { NotificationDropdown } from "./NotificationDropdown";

describe("NotificationDropdown", () => {
  beforeEach(() => {
    hookMock.copy = getNotificationsCopy("en");
    hookMock.dir = "ltr";
    hookMock.canRead = true;
    hookMock.canManage = true;
    hookMock.isOpen = true;
    hookMock.unreadCount = 1;
    hookMock.notifications = [notificationFixture()];
    hookMock.loadState = "READY";
    hookMock.loadError = null;
    hookMock.actionState = "IDLE";
    hookMock.actionError = null;
    hookMock.isPending = false;
    hookMock.toggleOpen.mockReset();
    hookMock.close.mockReset();
    hookMock.markAllRead.mockReset();
    hookMock.markRead.mockReset();
    hookMock.acknowledge.mockReset();
  });

  it("hides the notification surface before a successful read-permission preflight", () => {
    hookMock.canRead = false;
    const { container } = render(<NotificationDropdown />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links the live preview to the reachable notification center and exposes safe actions", () => {
    render(<NotificationDropdown />);

    expect(screen.getByRole("link", { name: "View all notifications" }))
      .toHaveAttribute("href", "/notifications");
    fireEvent.click(screen.getByRole("button", { name: "Read all (canonical)" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(hookMock.markAllRead).toHaveBeenCalledTimes(1);
    expect(hookMock.markRead).toHaveBeenCalledWith(notificationFixture().id);
    expect(hookMock.acknowledge).toHaveBeenCalledWith(notificationFixture().id);
  });

  it("renders correlation evidence for dropdown failures", () => {
    hookMock.loadState = "ERROR";
    hookMock.notifications = [];
    hookMock.loadError = {
      isNormalized: true,
      httpStatus: 503,
      errorCode: "NOTIFICATIONS_UNAVAILABLE",
      message: "Unavailable",
      correlationId: "019f0000-0000-7000-8000-000000000099",
    };
    render(<NotificationDropdown />);

    expect(screen.getByText(/NOTIFICATIONS_UNAVAILABLE/)).toBeInTheDocument();
    expect(screen.getByText(/019f0000-0000-7000-8000-000000000099/))
      .toBeInTheDocument();
  });
});

function notificationFixture() {
  return {
    id: "019f0000-0000-7000-8000-000000000001",
    sourceApp: "core-app",
    notificationType: "tenant.user.invited",
    priority: "P2_NORMAL",
    title: "Invitation sent",
    body: "The invitation was sent.",
    actionUrl: null,
    entityType: null,
    entityId: null,
    channels: ["IN_APP"],
    metadata: {},
    createdAt: "2026-08-12T10:00:00.000Z",
    readAt: null,
    acknowledgedAt: null,
    deliveredAt: null,
  };
}
