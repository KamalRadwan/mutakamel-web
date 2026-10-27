// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileSecurity } from "./useProfileSecurity";

const mocks = vi.hoisted(() => ({
  post: vi.fn(), write: vi.fn(), commit: vi.fn(), retry: vi.fn(),
  readSession: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
const ID = "019f1000-0000-7000-8000-000000000202";
const SID = "019f1000-0000-7000-8000-000000000203";

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  user: { id: "019f1000-0000-7000-8000-000000000202", firstName: "Tenant", lastName: "Owner" },
  retryBootstrap: mocks.retry,
}) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { coreIdentity: { profile: {
  securityFailed: "Save failed", nameSaved: "Name saved", passwordSaved: "Password changed",
} } } }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({
  success: mocks.success, errorFromApi: mocks.error, outcomeFromApi: () => false,
}) }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post: mocks.post },
  commitTenantSessionResponse: mocks.commit,
  getStoredTenantSessionMeta: () => ({ sessionId: "019f1000-0000-7000-8000-000000000203", remember: true }),
  readWebAuthSessionResponse: mocks.readSession,
  withTenantAuthLock: (work: (signal: AbortSignal) => Promise<unknown>) => work(new AbortController().signal),
}));
vi.mock("@/lib/api/envelope", () => ({ writeCoreData: mocks.write, readCoreData: vi.fn() }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));

const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

describe("profile security writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { session: { id: SID } } });
    mocks.readSession.mockImplementation((value: unknown) => value);
  });
  afterEach(cleanup);

  it("sends password fields once and adopts the retained session without storing passwords", async () => {
    const view = renderHook(useProfileSecurity);
    act(() => {
      view.result.current.setCurrentPassword("old-secret");
      view.result.current.setNewPassword("Str0ng-Passw0rd!");
      view.result.current.setConfirmPassword("Str0ng-Passw0rd!");
    });
    await act(async () => { await view.result.current.submitPassword(event()); });
    expect(mocks.post).toHaveBeenCalledWith("/api/tenant/core/v1/auth/change-password",
      { currentPassword: "old-secret", newPassword: "Str0ng-Passw0rd!" },
      expect.objectContaining({ nonReplayable: true, skipAuthRefresh: true, skipAutoIdempotency: true }));
    expect(mocks.commit).toHaveBeenCalledWith({ session: { id: SID } }, { remember: true, notifyCurrentTab: false });
    expect(JSON.stringify(mocks.commit.mock.calls)).not.toContain("secret");
    expect(view.result.current.currentPassword).toBe("");
    expect(view.result.current.newPassword).toBe("");
    expect(view.result.current.confirmPassword).toBe("");
  });

  it("keeps a wrong-current-password error on the form and clears password fields", async () => {
    mocks.post.mockRejectedValueOnce({ status: 422, code: "CURRENT_PASSWORD_INVALID", message: "Incorrect current password" });
    const view = renderHook(useProfileSecurity);
    act(() => {
      view.result.current.setCurrentPassword("wrong");
      view.result.current.setNewPassword("Str0ng-Passw0rd!");
      view.result.current.setConfirmPassword("Str0ng-Passw0rd!");
    });
    await act(async () => { await view.result.current.submitPassword(event()); });
    expect(view.result.current.passwordError?.code).toBe("CURRENT_PASSWORD_INVALID");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(view.result.current.currentPassword).toBe("");
  });

  it("does not submit weak or unconfirmed passwords", async () => {
    const view = renderHook(useProfileSecurity);
    act(() => { view.result.current.setCurrentPassword("old"); view.result.current.setNewPassword("weak"); });
    await act(async () => { await view.result.current.submitPassword(event()); });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("sends only the owner's own trimmed names", async () => {
    mocks.write.mockResolvedValueOnce({
      id: ID, email: "owner@example.com", firstName: "Sara", lastName: "Ahmed",
      companyId: ID, branchId: ID, departmentId: ID, teamId: null, managerId: null,
      employeeCode: null, jobTitle: null, status: "ACTIVE", isTenantOwner: true,
      createdAt: "2026-10-17T10:00:00.000Z", updatedAt: "2026-10-17T11:00:00.000Z",
    });
    const view = renderHook(useProfileSecurity);
    act(() => { view.result.current.setFirstName(" Sara "); view.result.current.setLastName(" Ahmed "); });
    await act(async () => { await view.result.current.submitName(event()); });
    expect(mocks.write).toHaveBeenCalledWith("patch", "/api/tenant/core/v1/users/me", { firstName: "Sara", lastName: "Ahmed" }, { nonReplayable: true });
    expect(mocks.retry).toHaveBeenCalled();
    expect(view.result.current.nameError).toBeNull();
  });
});
