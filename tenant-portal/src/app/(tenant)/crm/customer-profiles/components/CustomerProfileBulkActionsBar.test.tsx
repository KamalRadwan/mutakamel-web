// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { customerProfilePath, type CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { CustomerProfileBulkActionsBar } from "./CustomerProfileBulkActionsBar";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["users.user.read"] } }) }));
vi.mock("../../leads/[id]/hooks/readLeadOwnerOptions", () => ({ readOwnerOptions: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => toast,
}));

const customer: CustomerProfileItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  displayName: "Al Noor Trading Co",
  profileType: "CORPORATE",
  status: "PROSPECT",
  companyName: "Al Noor Trading Co",
  imageUrl: null,
  phone: "+966501234567",
  phones: ["+966501234567"],
  email: "info@alnoor.sa",
  companyWebsite: "https://alnoor.sa",
  country: "Saudi Arabia",
  city: "Riyadh",
  primaryContactName: "Khaled Omar",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000030",
    displayName: "Khaled Omar",
    jobTitle: "Procurement Director",
    phones: ["+966501234567"],
    email: "khaled@alnoor.sa",
    isPrimary: true,
  },
  tags: [
    {
      id: "0192f3a0-0000-7000-8000-000000000020",
      name: "VIP",
      backgroundColor: null,
      textColor: null,
    },
  ],
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  owner: {
    userId: "0192f3a0-0000-7000-8000-000000000010",
    firstName: "Kamal",
    lastName: "Radwan",
    avatarUrl: null,
  },
  nextActivity: null,
  acquisitionSourceNameAr: "الموقع",
  acquisitionSourceNameEn: "Website",
  sourceIconUrl: null,
  rating: 3,
  cardColor: "BLUE",
};
const items = [customer, { ...customer, id: "failed" }, { ...customer, id: "skipped" }];
const successfulResponse: AxiosResponse<unknown> = {
  data: undefined,
  status: 204,
  statusText: "No Content",
  headers: new Headers(),
};

function renderBar(selectedItems = items, allowedOwnerIds: string[] | null = null) {
  const onCompleted = vi.fn();
  const onClearSelection = vi.fn();
  const onScheduleActivity = vi.fn();
  render(<CustomerProfileBulkActionsBar
    allowedOwnerIds={allowedOwnerIds}
    selectedItems={selectedItems}
    totalAvailable={selectedItems.length}
    branchId={customer.branchId}
    canUpdate={(item) => item.id !== "skipped"}
    canDelete={(item) => item.id !== "skipped"}
    onSelectAll={vi.fn()}
    onClearSelection={onClearSelection}
    onCompleted={onCompleted}
    onScheduleActivity={onScheduleActivity}
  />);
  return { onCompleted, onClearSelection, onScheduleActivity };
}

function deleteSelected(count: number) {
  fireEvent.click(screen.getByRole("button", { name: `Delete (${count})` }));
  expect(axiosClient.delete).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.confirmDelete }));
}

function activeOpportunitiesError() {
  return new TenantApiClientError("internal server evidence", {
    status: 409, statusText: "Conflict", headers: new Headers(),
    data: { errorCode: "CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES" },
  });
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

describe("customer bulk outcomes", () => {
  it.each([
    { allowed: ["0192f3a0-0000-7000-8000-000000000010"], names: ["Kamal Radwan"] },
    { allowed: null, names: ["Kamal Radwan", "Other Owner"] },
    { allowed: [], names: [] },
  ])("limits bulk owner choices to $allowed", async ({ allowed, names }) => {
    vi.mocked(readOwnerOptions).mockResolvedValue([
      { id: "0192f3a0-0000-7000-8000-000000000010", firstName: "Kamal", lastName: "Radwan" },
      { id: "0192f3a0-0000-7000-8000-000000000011", firstName: "Other", lastName: "Owner" },
    ]);
    renderBar([customer], allowed);
    fireEvent.click(screen.getByRole("button", { name: "Assign Owner" }));
    await waitFor(() => expect(readOwnerOptions).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(en.common.loading)).toBeNull());
    for (const name of ["Kamal Radwan", "Other Owner"]) {
      expect(Boolean(screen.queryByRole("button", { name: new RegExp(`${name}$`) }))).toBe(names.includes(name));
    }
  });

  it("reports mixed delete counts and translated reasons, completing only successful IDs", async () => {
    vi.mocked(axiosClient.delete).mockResolvedValueOnce(successfulResponse).mockRejectedValueOnce(activeOpportunitiesError());
    const { onCompleted, onClearSelection } = renderBar();
    deleteSelected(2);
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith([customer.id]));
    expect(vi.mocked(axiosClient.delete).mock.calls.map(([path]) => path)).toEqual([
      customerProfilePath(customer.id), customerProfilePath("failed"),
    ]);
    expect(toast.error).toHaveBeenCalledWith(en.crmCustomerProfiles.bulkActions.incompleteTitle,
      expect.stringContaining("Eligible: 2. Succeeded: 1. Skipped: 1. Failed: 1."));
    expect(toast.error.mock.calls[0][1]).toContain(en.crmCustomerProfiles.bulkActions.skippedReason);
    expect(toast.error.mock.calls[0][1]).toContain(en.crmShared.refusals.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES);
    expect(toast.success).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("reports an all-failed delete without clearing selection", async () => {
    vi.mocked(axiosClient.delete).mockRejectedValue(activeOpportunitiesError());
    const { onCompleted, onClearSelection } = renderBar(items.slice(0, 2));
    deleteSelected(2);
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith([]));
    expect(toast.error).toHaveBeenCalledWith(en.crmCustomerProfiles.bulkActions.incompleteTitle,
      expect.stringContaining("Eligible: 2. Succeeded: 0. Skipped: 0. Failed: 2."));
    expect(toast.error.mock.calls[0][1]).toContain(formatTemplate(en.crmCustomerProfiles.bulkActions.reasonCount, {
      reason: en.crmShared.refusals.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES, count: "2",
    }));
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("reports mixed update outcomes and keeps failures and skips out of completed IDs", async () => {
    vi.mocked(axiosClient.patch).mockResolvedValueOnce(successfulResponse).mockRejectedValueOnce(new Error("offline"));
    const { onCompleted, onClearSelection } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Set Rating" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear rating" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith([customer.id]));
    expect(axiosClient.patch).toHaveBeenCalledTimes(2);
    expect(toast.error.mock.calls[0][1]).toContain("Eligible: 2. Succeeded: 1. Skipped: 1. Failed: 1.");
    expect(toast.error.mock.calls[0][1]).toContain(en.crmShared.errorOffline);
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("completes every successful ID after a fully successful delete", async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue(successfulResponse);
    const { onCompleted } = renderBar(items.slice(0, 2));
    deleteSelected(2);
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith([customer.id, "failed"]));
    expect(toast.success).toHaveBeenCalledWith(en.crmCustomerProfiles.bulkActions.deletedTitle,
      "Eligible: 2. Succeeded: 2. Skipped: 0. Failed: 0.");
  });

  it("hides scheduling for multiple customers", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: en.crmCustomerProfiles.bulkActions.scheduleActivity })).toBeNull();
  });

  it("schedules the sole selected customer", () => {
    const { onScheduleActivity } = renderBar([customer]);
    fireEvent.click(screen.getByRole("button", { name: en.crmCustomerProfiles.bulkActions.scheduleActivity }));
    expect(onScheduleActivity).toHaveBeenCalledWith(customer);
  });
});
