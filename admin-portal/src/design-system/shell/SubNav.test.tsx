/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubNav } from "./SubNav";

const viewState = vi.hoisted(() => ({
  pathname: "/settings/auth",
  lang: "en" as "en" | "ar",
  dir: "ltr" as "ltr" | "rtl",
  scrollToStart: vi.fn(),
  scrollToEnd: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => viewState.pathname,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: viewState.lang, dir: viewState.dir }),
}));

vi.mock("./useSubNav", () => ({
  useSubNav: () => ({
    scrollerRef: { current: null },
    canScrollStart: true,
    canScrollEnd: true,
    scrollToStart: viewState.scrollToStart,
    scrollToEnd: viewState.scrollToEnd,
  }),
}));

const items = [
  { href: "/settings/platform", labelKey: { en: "Platform", ar: "المنصة" } },
  { href: "/settings/auth", labelKey: { en: "Authentication", ar: "المصادقة" } },
];

describe("SubNav", () => {
  beforeEach(() => {
    viewState.pathname = "/settings/auth";
    viewState.lang = "en";
    viewState.dir = "ltr";
    viewState.scrollToStart.mockClear();
    viewState.scrollToEnd.mockClear();
  });

  it("identifies the current destination and exposes labelled overflow controls", () => {
    render(<SubNav items={items} ariaLabel="Settings" />);

    expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Authentication" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Authentication" })).toHaveClass("bg-selected");

    fireEvent.click(screen.getByRole("button", { name: "Scroll Settings toward the beginning" }));
    fireEvent.click(screen.getByRole("button", { name: "Scroll Settings toward the end" }));

    expect(viewState.scrollToStart).toHaveBeenCalledOnce();
    expect(viewState.scrollToEnd).toHaveBeenCalledOnce();
  });

  it("localizes item and overflow-control names for Arabic", () => {
    viewState.lang = "ar";
    viewState.dir = "rtl";

    render(<SubNav items={items} ariaLabel="الإعدادات" />);

    expect(screen.getByRole("link", { name: "المصادقة" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "تمرير الإعدادات نحو البداية" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تمرير الإعدادات نحو النهاية" })).toBeInTheDocument();
  });
});
