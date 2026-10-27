// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { CustomerProfileItem } from "./useCustomerProfiles";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  errorFromApi: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { patch: mocks.patch },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({
    errorFromApi: mocks.errorFromApi,
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    outcomeFromApi: vi.fn(),
  }),
}));

const { useUpdateCustomerProfileCard } = await import(
  "./useUpdateCustomerProfileCard"
);

const profile: CustomerProfileItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  displayName: "Al-Amal Hospital",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  companyName: "Al-Amal Hospital",
  imageUrl: null,
  phone: null,
  phones: [],
  email: null,
  companyWebsite: null,
  country: "",
  city: "",
  primaryContactName: null,
  primaryContact: null,
  tags: [],
  ownerUserId: null,
  owner: null,
  nextActivity: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  sourceIconUrl: null,
  rating: 2,
  cardColor: "TEAL",
};

beforeEach(() => {
  mocks.patch.mockReset();
  mocks.errorFromApi.mockReset();
});

describe("useUpdateCustomerProfileCard", () => {
  it("returns a rejected outcome, rolls back a 422, and uses translated feedback", async () => {
    const applyCardFields = vi.fn();
    const reconcile = vi.fn();
    mocks.patch.mockRejectedValue(new TenantApiClientError("Invalid rating", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { message: "Raw server failure" },
    }));
    const { result } = renderHook(() => useUpdateCustomerProfileCard({
      branchId: profile.branchId, canUpdate: () => true, applyCardFields, reconcile,
    }));
    await act(async () => {
      expect(await result.current.updateCard(profile, { rating: 3 })).toEqual({
        ok: false, error: expect.objectContaining({ status: 422 }),
      });
    });
    expect(applyCardFields.mock.calls).toEqual([
      [profile.id, { rating: 3 }], [profile.id, { rating: profile.rating }],
    ]);
    expect(mocks.errorFromApi).toHaveBeenCalledWith(
      en.crmShared.errorValidation, expect.objectContaining({ status: 422 }),
    );
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("applies the rating optimistically, adopts the confirmed value, and reloads", async () => {
    const applyCardFields = vi.fn();
    const reconcile = vi.fn();
    mocks.patch.mockResolvedValue({
      data: {
        id: profile.id,
        branchId: profile.branchId,
        rating: 3,
        cardColor: "TEAL",
      },
    });
    const { result } = renderHook(() =>
      useUpdateCustomerProfileCard({
        branchId: profile.branchId,
        canUpdate: () => true,
        applyCardFields,
        reconcile,
      }),
    );

    await act(async () => {
      expect(await result.current.updateCard(profile, { rating: 3 })).toEqual({
        ok: true, patch: { rating: 3 },
      });
    });

    expect(applyCardFields.mock.calls).toEqual([
      [profile.id, { rating: 3 }],
      [profile.id, { rating: 3 }],
    ]);
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it("restores the stored fields and reloads after an ambiguous failure", async () => {
    const applyCardFields = vi.fn();
    const reconcile = vi.fn();
    mocks.patch.mockRejectedValue(new Error("connection lost"));
    const { result } = renderHook(() =>
      useUpdateCustomerProfileCard({
        branchId: profile.branchId,
        canUpdate: () => true,
        applyCardFields,
        reconcile,
      }),
    );

    await act(async () => {
      await result.current.updateCard(profile, { cardColor: "BLUE" });
    });

    expect(applyCardFields.mock.calls).toEqual([
      [profile.id, { cardColor: "BLUE" }],
      [profile.id, { cardColor: "TEAL" }],
    ]);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(mocks.errorFromApi).toHaveBeenCalledWith(
      en.crmCustomerProfiles.cardUpdateAmbiguous,
      expect.objectContaining({ status: 0 }),
    );
  });
});
