// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";
import { CustomerProfileIdentityCard } from "./CustomerProfileIdentityCard";

const { toastError, tagAccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  tagAccess: { permissions: ["crm.tags.read"] as string[], isTenantOwner: false },
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ error: toastError }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: tagAccess }),
}));
vi.mock("../../../leads/components/create-lead/CreateTagModal", () => ({
  CreateTagModal: () => null,
}));

const profile: CustomerProfileDetail = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  displayName: "Customer",
  companyName: "Customer",
  companyEmail: null,
  companyPhone: null,
  companyWebsite: null,
  email: null,
  primaryMobile: null,
  phones: [],
  address: null,
  contacts: [],
  taxNumber: null,
  commercialRegistrationNumber: null,
  legalName: null,
  description: null,
  ownerUserId: null,
  sourceLeadId: null,
  acquisitionSourceId: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  createdAt: "2026-10-17T10:00:00Z",
  updatedAt: "2026-10-17T10:00:00Z",
};
const tag = {
  id: "0192f3a0-0000-7000-8000-000000000004",
  name: "VIP",
  backgroundColor: null,
  textColor: null,
};
const tagsPath = `${customerProfilePath(profile.id)}/tags`;
const response = (data: unknown): AxiosResponse<unknown> => ({
  data, status: 200, statusText: "OK", headers: new Headers(),
});

beforeEach(() => {
  tagAccess.permissions = ["crm.tags.read"];
  tagAccess.isTenantOwner = false;
  vi.spyOn(axiosClient, "get").mockImplementation(async (path) => response(
    path === tagsPath ? [] : [{ ...tag, createdAt: profile.createdAt, updatedAt: profile.updatedAt }],
  ));
  toastError.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function attach() {
  fireEvent.click(screen.getByRole("button", { name: "Attach Tag" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ VIP" }));
}

describe("customer-profile identity tag writes", () => {
  it("sends tagIds and renders the server array, including after reload", async () => {
    const saved = { ...tag, name: "Server VIP" };
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue(response([saved]));
    const view = render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    await attach();
    expect(post).toHaveBeenCalledWith(tagsPath, { tagIds: [tag.id] }, { skipAutoIdempotency: true });
    expect(await screen.findByRole("button", { name: "Remove tag Server VIP" })).toBeTruthy();
    view.unmount();
    vi.mocked(axiosClient.get).mockResolvedValue(response([saved]));
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    expect(await screen.findByRole("button", { name: "Remove tag Server VIP" })).toBeTruthy();
    expect(toastError).not.toHaveBeenCalled();
  });

  it.each([new Error("HTTP 400"), null, { tags: [tag] }])(
    "rolls back a rejected or unreadable attach (%s)", async (result) => {
      const post = vi.spyOn(axiosClient, "post");
      if (result instanceof Error) post.mockRejectedValue(result);
      else post.mockResolvedValue(response(result));
      render(<CustomerProfileIdentityCard profile={profile} canEdit />);
      await attach();
      await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.crmTags.errors.saveFailed));
      expect(screen.queryByRole("button", { name: "Remove tag VIP" })).toBeNull();
    },
  );

  it("blocks overlapping writes, restores a failed detach and permits retry", async () => {
    let resolveAttach!: (value: AxiosResponse<unknown>) => void;
    vi.spyOn(axiosClient, "post").mockReturnValue(new Promise((resolve) => { resolveAttach = resolve; }));
    const remove = vi.spyOn(axiosClient, "delete").mockRejectedValue(new Error("HTTP 403"));
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    await attach();
    fireEvent.click(screen.getByRole("button", { name: "Remove tag VIP" }));
    expect(remove).not.toHaveBeenCalled();
    await act(async () => resolveAttach(response([tag])));
    fireEvent.click(screen.getByRole("button", { name: "Remove tag VIP" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.crmTags.errors.saveFailed));
    expect(screen.getByRole("button", { name: "Remove tag VIP" })).toBeTruthy();
    remove.mockResolvedValue(response(undefined));
    fireEvent.click(screen.getByRole("button", { name: "Remove tag VIP" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove tag VIP" })).toBeNull());
    expect(remove).toHaveBeenCalledTimes(2);
  });
});

describe("customer-profile identity tag access", () => {
  it("offers tag creation to a tag manager without requiring catalogue read", () => {
    tagAccess.permissions = ["crm.tags.manage"];
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    expect(screen.getByRole("button", { name: en.crmTags.add })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Attach Tag" })).toBeNull();
    expect(axiosClient.get).not.toHaveBeenCalledWith("/api/tenant/crm/v1/tags", expect.anything());
  });

  it("hides creation from a catalogue reader", () => {
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    expect(screen.getByRole("button", { name: "Attach Tag" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.crmTags.add })).toBeNull();
  });

  it("preserves attached tags without catalogue access", async () => {
    tagAccess.permissions = [];
    vi.mocked(axiosClient.get).mockResolvedValue(response([tag]));
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    expect(await screen.findByRole("button", { name: "Remove tag VIP" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Attach Tag" })).toBeNull();
    expect(screen.queryByRole("button", { name: en.crmTags.add })).toBeNull();
  });

  it("allows a tenant owner to create and pick tags", () => {
    tagAccess.permissions = [];
    tagAccess.isTenantOwner = true;
    render(<CustomerProfileIdentityCard profile={profile} canEdit />);
    expect(screen.getByRole("button", { name: en.crmTags.add })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Attach Tag" })).toBeTruthy();
  });

  it.each([new Error("HTTP 503"), { items: [] }])(
    "reports a failed or malformed catalogue and allows retry (%s)", async (result) => {
      vi.mocked(axiosClient.get).mockImplementation(async (path) => {
        if (path === tagsPath) return response([]);
        if (result instanceof Error) throw result;
        return response(result);
      });
      render(<CustomerProfileIdentityCard profile={profile} canEdit />);
      fireEvent.click(screen.getByRole("button", { name: "Attach Tag" }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.crmTags.loadFailed));
      vi.mocked(axiosClient.get).mockResolvedValue(response([
        { ...tag, createdAt: profile.createdAt, updatedAt: profile.updatedAt },
      ]));
      fireEvent.click(screen.getByRole("button", { name: "Attach Tag" }));
      expect(await screen.findByRole("button", { name: "+ VIP" })).toBeTruthy();
    },
  );
});
