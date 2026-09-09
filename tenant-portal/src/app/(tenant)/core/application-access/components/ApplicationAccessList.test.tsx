// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { ApplicationAccessListItem } from "../application-access-list";
const readHook = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useApplicationAccessList", () => ({ useApplicationAccessList: readHook }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => {
  const original = await loadOriginal<typeof import("@/i18n/useLanguage")>();
  return { ...original, useLanguage: () => "en", useDictionary: () => en };
});
const { ApplicationAccessList } = await import("./ApplicationAccessList");
const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const scope = { kind: "BRANCH" as const, companyId: id(1), branchId: id(2) };
const base: ApplicationAccessListItem = {  scope, target: { applicationId: id(3), applicationKey: "crm", addonId: null, addonKey: null },
  resourceScope: "COMPANY", resource: { kind: "APPLICATION_ACTIVATION", id: id(4), state: "STORED", revision: "1", enabled: true },
  observation: "LOCAL_PROJECTION", operationalUse: "NOT_EVALUATED" };
const addon: ApplicationAccessListItem = { ...base, target: { ...base.target, addonId: id(5), addonKey: "crm.logistics" }, resourceScope: "BRANCH",
  resource: { kind: "BRANCH_OVERRIDE", state: "NOT_CREATED", id: null, revision: "0", mode: null, definitionVersionId: null, configVersionId: null,
    companyApplicationEnabled: true, companyAddonEnabled: true } };
function arrange(denied = false) {
  readHook.mockReturnValue({ t: en, loading: false, denied, error: null, reload: vi.fn(), changePage: vi.fn(),
    data: { items: [base, addon], meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false } },
    labels: { retry: en.common.retry, errorTitle: en.applicationAccess.loadFailed, emptyTitle: en.applicationAccess.directoryEmpty,
      selectAll: en.common.actions, selectRow: en.common.actions, sortAscending: en.views.sortAscending, sortDescending: en.views.sortDescending, notSorted: en.views.notSorted,
      pagination: { previous: en.common.previousPage, next: en.common.nextPage, summary: (from: number, to: number, total: number) => `${from}-${to}/${total}` } } });
}
afterEach(cleanup);

describe("Branch-scoped directory links", () => {
  it("renders inherited base facts without escalating to a Company detail link", () => {
    arrange(); render(<ApplicationAccessList scope="BRANCH" scopeId={id(2)} />);
    expect(screen.getByText(en.applicationAccess.inheritedBase)).toBeInTheDocument();
    const detail = screen.getByRole("link", { name: en.applicationAccess.viewDetails });
    expect(detail).toHaveAttribute("href", `/core/application-access/branches/${id(2)}/application-activations/crm/addons/crm.logistics`);
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href")?.includes(`/companies/${id(1)}`))).toBe(false);
  });
  it("does not render rows or links when the server denies the scoped list", () => {
    arrange(true); render(<ApplicationAccessList scope="BRANCH" scopeId={id(2)} />);
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(screen.queryByText("crm.logistics")).not.toBeInTheDocument();
  });
});
