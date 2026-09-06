// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavLocation, type NavLocation } from "./useNavLocation";
import { NAV_SECTIONS, type NavSection } from "./nav-config";

// The nav location is what replaced the sidebar's permanently visible active
// row: `PageActionBar` names it at the start of the bar, and `NavMenu` marks the
// owning section's trigger. Both are wrong on every detail route if the
// longest-prefix rule below is wrong, so it is pinned against the real map
// rather than a fixture.

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(cleanup);

function locate(route: string, sections: NavSection[] = NAV_SECTIONS): NavLocation {
  pathname = route;
  let captured: NavLocation | undefined;

  function Probe() {
    captured = useNavLocation(sections);
    return null;
  }

  render(<Probe />);
  return captured!;
}

describe("useNavLocation", () => {
  it.each([
    ["/crm/leads", "crm", "leads"],
    ["/trade/items", "tradeFoundation", "tradeItems"],
    ["/core/users", "coreIdentity", "coreUsers"],
  ] as const)("resolves %s to its section and item", (route, section, item) => {
    const location = locate(route);
    expect(location.section?.id).toBe(section);
    expect(location.itemId).toBe(item);
  });

  // A detail route has no nav entry of its own and must resolve to the list it
  // belongs to — otherwise the bar goes blank the moment anyone opens a record.
  it("resolves a detail route to its list's entry", () => {
    expect(locate("/crm/leads/018f-not-a-real-id").itemId).toBe("leads");
    expect(locate("/trade/items/018f/history").itemId).toBe("tradeItems");
  });

  // THE case the length comparison exists for. `/core/settings` and
  // `/core/settings/currencies` are both nav items and both prefix this route;
  // a first-match scan returns whichever the map happens to list first, and the
  // map lists the hub first — so every settings screen would read "All
  // settings". Delete `item.href.length <= bestLength` and this goes red.
  it("prefers the most specific entry when two nav items both prefix the route", () => {
    expect(locate("/core/settings/currencies").itemId).toBe("coreCurrencies");
    expect(locate("/core/settings").itemId).toBe("coreSettingsHub");
  });

  // A prefix is only a match at a path boundary. Without the `/` check
  // `/crm/lead-stages` matches `/crm/leads`, and the two most-used CRM screens
  // report each other.
  it("does not let one entry claim a sibling whose path merely starts the same", () => {
    expect(locate("/crm/lead-stages").itemId).toBe("leadStages");
  });

  it("reports nothing for a route on no nav entry", () => {
    const location = locate("/unavailable");
    expect(location.section).toBeNull();
    expect(location.itemId).toBeNull();
    expect(location.itemLabelKey).toBeNull();
  });

  // The caller passes PERMISSION-FILTERED sections, so an item this actor
  // cannot reach must not name their location either — they got here by URL and
  // the screen is about to render PermissionGate.
  it("only resolves against the sections it was given", () => {
    const crmOnly = NAV_SECTIONS.filter((section) => section.app === "crm");
    expect(locate("/core/users", crmOnly).itemId).toBeNull();
  });
});
