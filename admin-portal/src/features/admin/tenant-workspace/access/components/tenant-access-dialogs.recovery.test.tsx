// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "./tenant-access-dialogs";
import { useTenantAccess } from "../use-tenant-access";
import { tenantAccessCopy } from "../copy";
import type { TenantUserView } from "../types";
import { COMMAND_ID, TENANT_ID, USER_ID, pageFixture, summaryFixture, userFixture } from "../__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  listUsers: vi.fn(),
  summarizeUsers: vi.fn(),
  listBranches: vi.fn(),
  uuid: vi.fn(),
}));
const permissions = ["admin.tenant_users.read", "admin.tenant_users.reset_password", "admin.tenant_users.critical"];
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions }, isLoading: false }),
}));
vi.mock("@/lib/auth/rbac", () => ({
  adminCanAll: (_user: unknown, required: readonly string[]) =>
    required.every((permission) => permissions.includes(permission)),
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: mocks.uuid }));
vi.mock("../api", () => ({
  toTenantUserSummaryQuery: () => ({ visibility: "ACTIVE" }),
  tenantAccessApi: mocks,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
  useOptionalI18n: () => null,
}));

function setup(user: TenantUserView, locale: "en" | "ar") {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const copy = tenantAccessCopy(locale);
  function RecoveryDialog() {
    const controller = useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE", locale });
    return <ConfirmationDialog controller={controller} copy={copy} locale={locale}
      user={user} action="reset-password" onClose={onClose} onSuccess={onSuccess} />;
  }
  render(<RecoveryDialog />);
  return { copy, onSuccess, onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.uuid.mockReturnValueOnce(COMMAND_ID).mockReturnValue("019ff251-4000-7000-8000-000000000002");
  mocks.resetPassword.mockResolvedValue({ userId: USER_ID, delivery: "QUEUED" });
  mocks.listUsers.mockResolvedValue(pageFixture([userFixture()]));
  mocks.summarizeUsers.mockResolvedValue(summaryFixture);
  mocks.listBranches.mockResolvedValue(pageFixture([]));
});
afterEach(cleanup);

describe.each(["en", "ar"] as const)("tenant recovery confirmation (%s)", (locale) => {
  it.each(["ACTIVE", "INVITED", "SUSPENDED"] as const)("sends recovery for %s and shows the delivery outcome", async (status) => {
    const user = userFixture({ status, isTenantOwner: status === "INVITED" });
    const { copy, onSuccess, onClose } = setup(user, locale);
    expect(screen.getByText(copy.confirmReset)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy.confirm }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(copy.deliveryQueued));
    expect(mocks.resetPassword).toHaveBeenCalledWith(TENANT_ID, user.id, COMMAND_ID, locale);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("distinguishes an already queued delivery", async () => {
    mocks.resetPassword.mockResolvedValue({ userId: USER_ID, delivery: "ALREADY_QUEUED" });
    const { copy, onSuccess } = setup(userFixture(), locale);
    fireEvent.click(screen.getByRole("button", { name: copy.confirm }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(copy.deliveryAlreadyQueued));
  });

  it.each([
    userFixture({ status: "DEACTIVATED" }),
    userFixture({ deletedAt: "2026-10-18T00:00:00.000Z" }),
  ])("keeps a precondition failure visible and focused ($status, $deletedAt)", async (user) => {
    const { copy, onSuccess, onClose } = setup(user, locale);
    fireEvent.click(screen.getByRole("button", { name: copy.confirm }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.resetPasswordUnavailable);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(mocks.resetPassword).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("preserves a delivery failure and retries the same command identity", async () => {
    const message = locale === "ar" ? "تعذر إرسال رسالة الأمان. أعد المحاولة." : "Security email could not be queued. Try again.";
    mocks.resetPassword.mockRejectedValueOnce({
      response: { status: 503, data: {
        success: false, errorCode: "TENANT_USER_EMAIL_DELIVERY_UNAVAILABLE",
        message, correlationId: "recovery-503",
      } },
    });
    const user = userFixture({ status: "SUSPENDED" });
    const { copy, onSuccess, onClose } = setup(user, locale);
    fireEvent.click(screen.getByRole("button", { name: copy.confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent(`${message} · recovery-503`);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: copy.confirm }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(copy.deliveryQueued));
    expect(mocks.resetPassword).toHaveBeenCalledTimes(2);
    expect(mocks.uuid).toHaveBeenCalledOnce();
    expect(mocks.resetPassword.mock.calls[1]).toEqual(mocks.resetPassword.mock.calls[0]);
  });
});
