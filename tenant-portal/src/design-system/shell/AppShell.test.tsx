// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

// B6 — the skip link is the first focusable element in the app, and it
// targets <main id="main">. docs/design/shell.md#skip-link.
//
// AppShell reads the dictionary, the permission set and the router, none of
// which a unit test should stand up for real. Each is replaced with the
// smallest stub that keeps the shell rendering, following the convention in
// app/(tenant)/core/authentication/page.test.tsx.

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    dir: "ltr",
    t: {
      common: { skipToContent: "Skip to content", notifications: "Notifications" },
      nav: { workspaceCenter: "Workspace center" },
    },
  }),
}));

vi.mock("./useNavTree", () => ({ useNavTree: () => [] }));
vi.mock("./Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("./MobileNav", () => ({ MobileNav: () => null }));
vi.mock("./Sidebar", () => ({ Sidebar: () => <nav /> }));
// Both need the Next router / connectivity APIs, and neither is what this
// test is about — it asserts the ORDER of focusable elements, so the stubs
// must render nothing focusable.
vi.mock("./NavCommandPalette", () => ({ NavCommandPalette: () => null }));
vi.mock("../patterns/offline-banner/OfflineBanner", () => ({ OfflineBanner: () => null }));
vi.mock("../patterns/offline-banner/useConnectivity", () => ({
  useConnectivity: () => ({ status: "online" }),
}));

afterEach(cleanup);

describe("AppShell", () => {
  it("renders the skip link as the first focusable element, targeting #main", () => {
    const { container } = render(
      <AppShell initialSidebarState="expanded">
        <p>Workspace</p>
      </AppShell>,
    );

    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];

    expect(first).toBeInstanceOf(HTMLAnchorElement);
    expect(first).toHaveAttribute("href", "#main");
    expect(first).toHaveTextContent("Skip to content");
  });

  it("gives <main> the id the skip link points at, and a tabIndex so it can take focus", () => {
    render(
      <AppShell initialSidebarState="expanded">
        <p>Workspace</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    // Without tabIndex the browser scrolls to <main> but leaves focus at the
    // top of the document, so the next Tab lands back in the nav.
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});
