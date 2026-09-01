import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  CRM_NAV_SECTIONS,
  NAV_APPS,
  NAV_SECTIONS,
  TRADE_NAV_SECTIONS,
  WORKSPACE_NAV_SECTIONS,
  type NavAppId,
  type NavSection,
} from "./nav-config";

const ids = (sections: NavSection[]) => sections.map((section) => section.id);

// The three app sidebars, spelled out. Pinned rather than derived, because a
// test that recomputes the thing it is checking checks nothing: this is the
// list a reviewer reads to see which app owns which section, and it fails
// loudly when a section is added, moved between apps, or reordered.
const EXPECTED: Record<NavAppId, string[]> = {
  workspace: [
    "workspace",
    "coreIdentity",
    "coreOperations",
    "coreSettings",
    "coreBilling",
    "account",
  ],
  crm: ["crm", "crmAnalytics", "crmSetup"],
  trade: [
    "tradeFoundation",
    "tradeDocuments",
    "tradeInventory",
    "tradeGovernance",
    "tradeAutomation",
    "tradeAnalytics",
  ],
};

describe("the three app sidebars", () => {
  it("gives Workspace the portal's own sections and nothing else", () => {
    expect(ids(WORKSPACE_NAV_SECTIONS)).toEqual(EXPECTED.workspace);
    expect(WORKSPACE_NAV_SECTIONS.every((section) => section.app === "workspace")).toBe(true);
  });

  it("gives CRM its three sections and nothing else", () => {
    expect(ids(CRM_NAV_SECTIONS)).toEqual(EXPECTED.crm);
    expect(CRM_NAV_SECTIONS.every((section) => section.app === "crm")).toBe(true);
  });

  it("gives Trade its six sections and nothing else", () => {
    expect(ids(TRADE_NAV_SECTIONS)).toEqual(EXPECTED.trade);
    expect(TRADE_NAV_SECTIONS.every((section) => section.app === "trade")).toBe(true);
  });

  // The property the whole feature rests on. Scoping the sidebar is only safe
  // if it hides nothing permanently: every section must be reachable from
  // exactly one app, or a screen becomes unreachable from the nav the way six
  // Trade routes did before (Q40).
  it("partitions all 15 sections across the three apps, with no section in two", () => {
    const partitioned = [
      ...WORKSPACE_NAV_SECTIONS,
      ...CRM_NAV_SECTIONS,
      ...TRADE_NAV_SECTIONS,
    ];

    expect(NAV_SECTIONS).toHaveLength(15);
    expect(partitioned).toHaveLength(NAV_SECTIONS.length);
    expect(new Set(ids(partitioned)).size).toBe(NAV_SECTIONS.length);
    expect(new Set(ids(partitioned))).toEqual(new Set(ids(NAV_SECTIONS)));
  });

  it("offers exactly the three apps, each carrying its own section list", () => {
    expect(NAV_APPS.map((app) => app.id)).toEqual(["workspace", "crm", "trade"]);
    for (const app of NAV_APPS) {
      expect(ids(app.sections)).toEqual(EXPECTED[app.id]);
    }
  });
});

// The i18n gate. `Sidebar.tsx` reads labels as
// `t.nav[item.labelKey as keyof typeof t.nav]` — the `as` cast is what lets a
// labelKey that exists in no dictionary compile, render `undefined`, and ship.
// That is exactly how the six `tradeFoundation` keys stayed missing from both
// dictionaries. Structural drift BETWEEN the dictionaries is already caught by
// tsc (`en` is typed `Dictionary`, derived from `ar`); what tsc cannot see is a
// key nav-config references that neither dictionary defines.
describe("nav dictionary coverage", () => {
  const usedKeys = [
    ...NAV_SECTIONS.flatMap((section) => (section.labelKey ? [section.labelKey] : [])),
    ...NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.labelKey)),
    ...NAV_APPS.map((app) => app.labelKey),
  ];

  it.each([...new Set(usedKeys)])("resolves %s in both dictionaries", (key) => {
    expect(ar.nav).toHaveProperty(key);
    expect(en.nav).toHaveProperty(key);
    expect(ar.nav[key as keyof typeof ar.nav]).toBeTruthy();
    expect(en.nav[key as keyof typeof en.nav]).toBeTruthy();
  });

  // An Arabic-first portal that ships an English string in the Arabic
  // dictionary has a bug the type system cannot see — `workspaceCenter` was
  // one, and it labelled the sidebar itself.
  it("has no untranslated English values left in the Arabic nav block", () => {
    const untranslated = Object.entries(ar.nav).filter(
      ([, value]) => typeof value === "string" && !/[؀-ۿ]/u.test(value),
    );
    expect(untranslated).toEqual([]);
  });
});
