// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createAddonAssignmentsFixture } from "../application-addon-assignments.fixture";
const mocks = vi.hoisted(() => ({ read: vi.fn(), lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("../hooks/useAddonAssignments", () => ({ useAddonAssignments: mocks.read }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[mocks.lang], lang: mocks.lang }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => {
  const original = await loadOriginal<typeof import("@/i18n/useLanguage")>();
  return { ...original, useLanguage: () => mocks.lang, useDictionary: () => dictionaries[mocks.lang] };
});
const { AddonAssignments } = await import("./AddonAssignments");
const body = createAddonAssignmentsFixture();
function arrange(denied = false) {
  const t = dictionaries[mocks.lang];
  mocks.read.mockReturnValue({ t, data: { items: body.data, meta: body.meta }, loading: false, denied, error: null,
    reload: vi.fn(), changePage: vi.fn(), canBrowseUsers: false,
    labels: { retry: t.common.retry, errorTitle: t.addonAssignments.loadFailed, emptyTitle: t.addonAssignments.empty,
      selectAll: t.common.actions, selectRow: t.common.actions, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from: number, to: number, total: number) => `${from}-${to}/${total}` } } });
}
afterEach(cleanup);

describe("current local Addon allocation display", () => {
  it.each(["en", "ar"] as const)("preserves precise/local evidence without profile read or mutation controls in %s", (language) => {
    mocks.lang = language; arrange(); render(<AddonAssignments userId={body.data[0].userId} />);
    const t = dictionaries[language];
    expect(screen.getByText(t.addonAssignments.notice)).toBeInTheDocument();
    expect(screen.getByText(t.addonAssignments.scopeNotice)).toBeInTheDocument();
    expect(screen.getByText(body.data[0].assignmentRevision)).toBeInTheDocument();
    expect(screen.getByText(body.data[0].parentAssignmentId)).toBeInTheDocument();
    expect(screen.getByText(body.data[0].selectedDefinitionVersionId)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.addonAssignments.browseUsers })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.common.delete })).not.toBeInTheDocument();
  });
  it("reveals no allocation rows after authoritative denial", () => {
    mocks.lang = "en"; arrange(true); render(<AddonAssignments userId={body.data[0].userId} />);
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument(); expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(body.data[0].assignmentRevision)).not.toBeInTheDocument();
  });
});
