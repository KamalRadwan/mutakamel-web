// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <nav>Navbar</nav> }));
vi.mock("./components/SettingsSidebar", () => ({
  SettingsSidebar: () => <aside>Settings navigation</aside>,
}));

import SettingsLayout from "./layout";

describe("SettingsLayout", () => {
  it("does not block independently authorized child capabilities behind settings-read", () => {
    render(
      <SettingsLayout>
        <section>Currency operator capability</section>
      </SettingsLayout>,
    );
    expect(screen.getByText("Currency operator capability")).toBeTruthy();
  });
});
