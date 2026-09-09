// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { createAddonAssignmentOptionsFixture } from "../application-addon-assignment-options.fixture";
const mocks = vi.hoisted(() => ({ read: vi.fn(), lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar }, directions = { en: "ltr", ar: "rtl" };
vi.mock("../hooks/useAddonAssignmentOptions", () => ({ useAddonAssignmentOptions: mocks.read }));
vi.mock("./AddonAssignments", () => ({ AddonAssignments: () => <div>Existing assigned seats</div> }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[mocks.lang], lang: mocks.lang, dir: directions[mocks.lang] }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => mocks.lang, useDictionary: () => dictionaries[mocks.lang] }));
const { AddonAssignmentOptions } = await import("./AddonAssignmentOptions");
const { AddonSeatWorkspace } = await import("./AddonSeatWorkspace");
function arrange(denied = false) {
  const body = createAddonAssignmentOptionsFixture(); body.data[0].targetActive = false;
  body.data[0].localState.parentReadiness = "BLOCKED"; body.data[0].localState.adoptionPending = true;
  mocks.read.mockReturnValue({ data: { items: body.data, meta: body.meta }, loading: false, denied, error: null, reload: vi.fn(), changePage: vi.fn() });
  return body;
}
beforeEach(() => { mocks.read.mockReset(); mocks.lang = "en"; });
afterEach(cleanup);

describe("assignment precondition read-only presentation", () => {
  it.each(["en", "ar"] as const)("shows retained diagnostics and nullable pins without a grant in %s", (lang) => {
    mocks.lang = lang; const body = arrange(), t = dictionaries[lang];
    render(<AddonAssignmentOptions userId={body.data[0].userId} />);
    expect(screen.getByText(t.addonAssignmentOptions.notice)).toBeInTheDocument();
    expect(screen.getByText(t.addonAssignmentOptions.absent)).toBeInTheDocument();
    expect(screen.getByText(t.addonAssignmentOptions.status.BLOCKED)).toBeInTheDocument();
    expect(screen.getByText(body.data[0].allowanceRevision)).toBeInTheDocument();
    expect(screen.getByText(t.addonAssignmentOptions.sourcePins).tagName).toBe("SUMMARY");
    expect(screen.queryByText("BLOCKED")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign|remove|تخصيص|إزالة/i })).not.toBeInTheDocument();
  });
  it("reveals no retained IDs after authoritative denial", () => {
    const body = arrange(true); render(<AddonAssignmentOptions userId={body.data[0].userId} />);
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText(body.data[0].allowanceRevision)).not.toBeInTheDocument();
  });
  it("mounts only the chosen panel and keeps the old assignment read as the default", () => {
    const body = arrange(); render(<AddonSeatWorkspace userId={body.data[0].userId} />);
    expect(screen.getByText("Existing assigned seats")).toBeInTheDocument(); expect(mocks.read).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole("tab", { name: en.addonAssignmentOptions.optionsTab }));
    expect(screen.getByRole("tab", { name: en.addonAssignmentOptions.optionsTab })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(en.addonAssignmentOptions.notice)).toBeInTheDocument();
    expect(screen.queryByText("Existing assigned seats")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole("tab", { name: en.addonAssignmentOptions.assignedTab }));
    expect(screen.queryByText(en.addonAssignmentOptions.notice)).not.toBeInTheDocument();
    expect(screen.getByText("Existing assigned seats")).toBeInTheDocument();
  });
});
