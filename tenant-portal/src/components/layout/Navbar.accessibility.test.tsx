// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

vi.mock("./hooks/useNavbar", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const AppIcon = (props: { className?: string }) => (
    <span className={props.className} />
  );

  return {
    useNavbar: () => {
      const [isOpen, setIsOpen] = React.useState(false);
      const dropdownRef = React.useRef<HTMLDivElement>(null);
      const apps = [
        {
          id: "core",
          name: "Core",
          href: "/",
          icon: AppIcon,
          description: "Core workspace",
          isActive: true,
        },
        {
          id: "crm",
          name: "CRM",
          href: "/crm",
          icon: AppIcon,
          description: "Customer relationship management",
          isActive: false,
        },
      ];
      return {
        apps,
        activeApp: apps[0],
        isOpen,
        toggleDropdown: () => setIsOpen((current) => !current),
        closeDropdown: () => setIsOpen(false),
        dropdownRef,
      };
    },
  };
});

vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("./UserDropdown", () => ({ UserDropdown: () => null }));
vi.mock("./NotificationsDropdown", () => ({
  NotificationsDropdown: () => null,
}));
vi.mock("./CoreNavbarLinks", () => ({ CoreNavbarLinks: () => null }));
vi.mock("./CrmNavbarLinks", () => ({ CrmNavbarLinks: () => null }));

afterEach(cleanup);

describe("Tenant Navbar disclosure", () => {
  it("exposes app-switcher state and restores trigger focus on Escape", () => {
    render(<Navbar />);

    const trigger = screen.getByRole("button", {
      name: "Application switcher: Core",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Applications" });
    expect(menu).toHaveClass("fixed", "inset-x-2", "sm:absolute");
    expect(screen.getByRole("menuitem", { name: /Core/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
