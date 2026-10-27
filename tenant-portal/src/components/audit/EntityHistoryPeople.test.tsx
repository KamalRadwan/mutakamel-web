// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
const { api, auth, locale } = vi.hoisted(() => ({ api: { get: vi.fn() }, auth: { user: null as TenantUserProfile | null,
  realtimeAuthGeneration: "session-1" }, locale: { lang: "en" as "en" | "ar" } }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: api }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { en, ar }[locale.lang], lang: locale.lang }) }));
vi.mock("@/design-system", async () => ({
  ...await import("@/design-system/patterns/detail-section/DetailSection"),
  ...await import("@/design-system/patterns/error-state/ErrorState"),
  ...await import("@/design-system/patterns/timeline/Timeline"),
  ...await import("@/design-system/primitives/RatingStars"),
  ...await import("@/design-system/patterns/person-profile/PersonProfileLink"),
  ...await import("@/design-system/patterns/permission-gate/PermissionGate"),
}));
import { EntityHistoryCard } from "./EntityHistoryCard";
import { TenantApiClientError } from "@/lib/api/axiosClient";
const LEAD = "01900100-0000-7000-8000-000000000010";
const A = "01900100-0000-7000-8000-000000000011";
const B = "01900100-0000-7000-8000-000000000012";
const BRANCH = "01900100-0000-7000-8000-000000000013";
const SOURCE = "01900100-0000-7000-8000-000000000014";
const history = { id: "01900100-0000-7000-8000-0000000000a1", action: "LEAD_UPDATED", actorLabel: "Kamal Radwan",
  createdAt: "2026-09-14T10:18:00", outcome: "SUCCESS", diff: [
    { field: "ownerUserId", before: A, after: B }, { field: "activityAssignee", before: null, after: B },
  ] };
const core = (data: unknown) => ({ data: { success: true, data: Array.isArray(data) ? { items: data, nextCursor: null } : data, correlationId: "test" } });
function serve(path: string) {
  if (path.includes("/audit/")) return core([history]);
  if (path.endsWith(`/users/${A}`)) return core({ id: A, firstName: "Saly", lastName: "Essam", email: "saly@example.com" });
  if (path.endsWith(`/users/${B}`)) return core({ id: B, firstName: "Mostafa", lastName: "Saleh", email: "mostafa@example.com" });
  if (path.endsWith(`/branches/${BRANCH}`)) return core({ id: BRANCH, name: "Cairo" });
  if (path.endsWith(`/acquisition-sources/${SOURCE}`)) return { data: { id: SOURCE, nameEn: "Website", nameAr: "الموقع الإلكتروني", isActive: false } };
  throw new Error(`Unexpected read: ${path}`);
}
beforeEach(() => {
  vi.clearAllMocks(); locale.lang = "en";
  auth.user = { id: LEAD, firstName: "Kamal", lastName: "Radwan", email: "kamal@example.com", status: "ACTIVE", isTenantOwner: false,
    permissions: ["audit.read", "users.user.read", "org.branch.read", "crm.acquisition_sources.read"],
    permissionScopes: Object.fromEntries(
      ["audit.read", "users.user.read", "org.branch.read", "crm.acquisition_sources.read"]
        .map((key) => [key, { tenantWide: true, companyIds: [], branchIds: [] }]),
    ),
    accessibleBranches: [], accessibleCompanies: [], accessibleBranchCompanies: [], teamMemberships: [],
    accessScope: { mode: "EXPLICIT", branchesTruncated: false, companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 } };
  api.get.mockImplementation(async (path: string) => serve(path));
});
afterEach(cleanup);

async function renderHistory(props: Parameters<typeof EntityHistoryCard>[0] = { entityType: "Lead", entityId: LEAD }) {
  // Flush the history read and dependent profile reads before querying people.
  await act(async () => { render(<EntityHistoryCard {...props} />); });
}

describe("audit names and reusable contact cards", () => {
  it("resolves old/new salesperson names and opens the exact person's contact card, without internal data", async () => {
    await renderHistory();
    const oldName = await screen.findByRole("button", { name: "View Saly Essam's contact details" });
    expect(oldName).toHaveClass("line-through");
    await screen.findAllByRole("button", { name: "View Mostafa Saleh's contact details" });
    expect(document.body.textContent).not.toContain(A);
    expect(document.body.textContent).not.toContain(B);
    expect(api.get.mock.calls.filter(([path]) => String(path).includes("/users/"))).toHaveLength(2);
    oldName.focus(); fireEvent.click(oldName);
    const dialog = screen.getByRole("dialog", { name: "Saly Essam" });
    expect(within(dialog).getByText("saly@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText(en.personProfile.unavailable)).toBeInTheDocument();
    expect(within(dialog).queryByText("mostafa@example.com")).not.toBeInTheDocument();
    expect(within(dialog).getByText("SE")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(oldName).toHaveFocus();
    fireEvent.click(screen.getAllByRole("button", { name: "View Mostafa Saleh's contact details" })[0]);
    expect(within(screen.getByRole("dialog", { name: "Mostafa Saleh" })).getByText("mostafa@example.com")).toBeInTheDocument();
  });
  it("renders permission denial without leaking IDs or fetching unauthorized user details", async () => {
    auth.user!.permissions = ["audit.read"];
    await renderHistory();
    const names = await screen.findAllByRole("button", { name: "View Name unavailable's contact details" });
    fireEvent.click(names[0]);
    expect(within(screen.getByRole("dialog")).getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(A);
  });
  it("can retry a failed lookup inside its open contact card", async () => {
    let failing = true;
    api.get.mockImplementation(async (path: string) => {
      if (path.endsWith(`/users/${A}`) && failing) throw new Error("offline");
      return serve(path);
    });
    await renderHistory();
    fireEvent.click(await screen.findByRole("button", { name: "View Name unavailable's contact details" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(en.personProfile.loadFailed)).toBeInTheDocument();
    failing = false;
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.retry }));
    await screen.findByRole("dialog", { name: "Saly Essam" });
    expect(within(dialog).getByText("saly@example.com")).toBeInTheDocument();
  });
  it("honors an authoritative server 403 even when auth permissions allow a read", async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path.includes("/users/")) throw new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} });
      return serve(path);
    });
    await renderHistory();
    fireEvent.click((await screen.findAllByRole("button", { name: "View Name unavailable's contact details" }))[0]);
    expect(within(screen.getByRole("dialog")).getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.retry })).not.toBeInTheDocument();
  });
  it("shows branch and inactive source names through the correct Core/CRM contracts", async () => {
    api.get.mockImplementation(async (path: string) => path.includes("/audit/") ? core([{ ...history, diff: [
      { field: "branchId", before: null, after: BRANCH }, { field: "acquisitionSourceId", before: SOURCE, after: null },
    ] }]) : serve(path));
    await renderHistory();
    expect(await screen.findByText("Cairo")).toBeInTheDocument();
    expect(await screen.findByText("Website")).toHaveClass("line-through");
    expect(document.body.textContent).not.toContain(BRANCH);
    expect(document.body.textContent).not.toContain(SOURCE);
  });
  it("uses provided labels without a lookup and never displays unknown UUIDs", async () => {
    api.get.mockImplementation(async () => core([{ ...history, diff: [
      { field: "stageId", before: null, after: SOURCE }, { field: "unknownReferenceId", before: null, after: BRANCH },
    ] }]));
    await renderHistory({ entityType: "Lead", entityId: LEAD, valueLabels: { stageId: { [SOURCE]: "Qualified" } } });
    expect(await screen.findByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText(en.audit.valueUnavailable)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(BRANCH);
  });
  it("localizes the contact modal and source name in Arabic", async () => {
    locale.lang = "ar";
    api.get.mockImplementation(async (path: string) => path.includes("/audit/") ? core([{ ...history, diff: [
      { field: "ownerUserId", before: null, after: A }, { field: "acquisitionSourceId", before: null, after: SOURCE },
    ] }]) : serve(path));
    await renderHistory();
    expect(await screen.findByText("الموقع الإلكتروني")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "عرض بيانات التواصل مع Saly Essam" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(ar.personProfile.phone)).toBeInTheDocument();
    expect(within(dialog).getByText(ar.personProfile.email)).toBeInTheDocument();
  });
});
