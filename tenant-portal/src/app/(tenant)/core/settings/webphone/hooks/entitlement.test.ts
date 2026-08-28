import { describe, expect, it, vi } from "vitest";

// The module pulls in React and the portal's HTTP client; only the pure
// classifier is under test here.
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {},
  unwrapCoreData: (value: unknown) => value,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({}) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

import { entitlementFromError } from "./useTenantWebphoneSettings";

function refusal(status: number, code: string) {
  return { response: { status, data: { code, message: code } } };
}

describe("entitlementFromError", () => {
  it("keeps the three unavailable reasons apart", () => {
    expect(entitlementFromError(refusal(403, "WEBPHONE_MODULE_NOT_PURCHASED"))).toBe(
      "NOT_PURCHASED",
    );
    expect(entitlementFromError(refusal(409, "WEBPHONE_PROVISIONING_PENDING"))).toBe(
      "PROVISIONING_PENDING",
    );
    expect(entitlementFromError(refusal(403, "WEBPHONE_MODULE_INACTIVE"))).toBe(
      "SUSPENDED",
    );
  });

  it("leaves anything else a real error", () => {
    // A permission refusal is not an entitlement refusal, and must not be
    // disguised as "you did not buy this".
    expect(entitlementFromError(refusal(403, "AUTH_PERMISSION_DENIED"))).toBeNull();
    expect(entitlementFromError(refusal(500, "WEBPHONE_INTERNAL_ERROR"))).toBeNull();
    expect(entitlementFromError(refusal(404, "NOT_FOUND"))).toBeNull();
    expect(entitlementFromError(new Error("network down"))).toBeNull();
  });

  it("requires the status and the code to agree", () => {
    // The same code at the wrong status is not evidence of anything.
    expect(
      entitlementFromError(refusal(409, "WEBPHONE_MODULE_NOT_PURCHASED")),
    ).toBeNull();
    expect(
      entitlementFromError(refusal(403, "WEBPHONE_PROVISIONING_PENDING")),
    ).toBeNull();
  });
});
