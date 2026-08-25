// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserDropdown } from "./UserDropdown";

const notificationSnapshot = vi.hoisted(() => ({
  generation: null,
  lastRealtimeCursor: null,
  unreadCount: 2,
  items: [],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/authentication",
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));

vi.mock("@/lib/notifications/tenant-notification-runtime", () => ({
  markAllTenantNotificationsRead: vi.fn(),
  markTenantNotificationRead: vi.fn(),
  resyncTenantNotifications: vi.fn(),
  tenantNotificationRuntime: {
    subscribe: () => () => undefined,
    getSnapshot: () => notificationSnapshot,
  },
}));

vi.mock("./hooks/useUserDropdown", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useUserDropdown: () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return {
        lang: "en",
        isOpen,
        currentUser: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          tier: "TENANT_OWNER",
          roleName: "Tenant Owner",
        },
        toggleOpen: () => setIsOpen((current) => !current),
        close: () => setIsOpen(false),
        handleLogout: async () => undefined,
      };
    },
  };
});

afterEach(cleanup);

describe("Tenant Navbar popovers", () => {
  it("labels the user disclosure and restores focus on Escape", () => {
    render(<UserDropdown />);

    const trigger = screen.getByRole("button", {
      name: "Account menu for Ada Lovelace",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("fixed", "inset-x-2", "sm:absolute");
    expect(screen.getByRole("menuitem", { name: "Sign-in sessions" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keeps the notifications dialog inside the mobile viewport and dismisses it with Escape", () => {
    render(<NotificationsDropdown />);

    const trigger = screen.getByRole("button", {
      name: "Notifications, 2 unread",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Notifications Center",
    });
    expect(dialog).toHaveClass("fixed", "inset-x-2", "sm:absolute");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
