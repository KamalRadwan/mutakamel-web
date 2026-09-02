// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { RouteTitle } from "./RouteTitle";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function mount(at: string) {
  pathname = at;
  return render(
    <I18nProvider>
      <RouteTitle />
    </I18nProvider>,
  );
}

beforeEach(() => {
  setLanguage("ar");
  document.title = "";
});
afterEach(cleanup);

describe("RouteTitle", () => {
  it("names the route and keeps the brand as the suffix", () => {
    mount("/crm/leads");
    expect(document.title).toContain(ar.nav.leads);
    expect(document.title).toContain(ar.common.portalName);
    expect(document.title.endsWith(ar.common.portalName)).toBe(true);
  });

  it("gives two routes two different titles", () => {
    const first = mount("/crm/leads");
    const leads = document.title;
    first.unmount();

    mount("/core/users");
    // The defect: all 132 routes shared one metadata block, so every tab in a
    // user's window read the same string (U17).
    expect(document.title).not.toBe(leads);
  });

  it("follows the language toggle", () => {
    mount("/crm/leads");
    expect(document.title).toContain(ar.nav.leads);

    // The toggle writes to the language store, which is a useSyncExternalStore
    // subscription — act() flushes the re-render it schedules.
    act(() => setLanguage("en"));
    expect(document.title).toContain(en.nav.leads);
    expect(document.title).toContain(en.common.portalName);
  });

  it("gives a detail route its list's title", () => {
    mount("/crm/leads/0198c4a2-7f31-7c2e-9b40-1d5f8e2a6c11");
    expect(document.title).toContain(ar.nav.leads);
  });

  it("falls back to the portal default for a route no nav entry owns", () => {
    mount("/definitely-not-a-route");
    expect(document.title).toContain(ar.common.portalName);
    expect(document.title).toContain(ar.common.appName);
  });
});
