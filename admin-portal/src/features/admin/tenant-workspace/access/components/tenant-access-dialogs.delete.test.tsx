// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog, type ConfirmationAction } from "./tenant-access-dialogs";
import { tenantAccessCopy } from "../copy";
import type { TenantAccessController } from "../use-tenant-access";
import { userFixture } from "../__tests__/fixtures";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
  useOptionalI18n: () => null,
}));

afterEach(cleanup);

function setup(locale: "en" | "ar", action: ConfirmationAction = "delete", pending = false) {
  const user = userFixture();
  const copy = tenantAccessCopy(locale);
  const commands = {
    deleteUser: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue({ delivery: "QUEUED" }),
    resendInvite: vi.fn().mockResolvedValue(undefined),
    suspendUser: vi.fn().mockResolvedValue(undefined),
    activateUser: vi.fn().mockResolvedValue(undefined),
    restoreUser: vi.fn().mockResolvedValue(undefined),
  };
  const controller = {
    command: { pending, error: null },
    ...commands,
  } as unknown as TenantAccessController;
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<ConfirmationDialog controller={controller} copy={copy} locale={locale}
    user={user} action={action} onClose={onClose} onSuccess={onSuccess} />);
  return { user, copy, commands, onClose, onSuccess };
}

describe.each(["en", "ar"] as const)("tenant user delete confirmation (%s)", (locale) => {
  it("requires the exact email before deleting and disables again when it changes", async () => {
    const { user, copy, commands, onClose, onSuccess } = setup(locale);
    const input = screen.getByLabelText(copy.deleteEmailConfirmation, { exact: false });
    const confirm = screen.getByRole("button", { name: copy.confirm });
    expect(screen.getByText(copy.deleteEmailConfirmation)).toBeVisible();
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(commands.deleteUser).not.toHaveBeenCalled();

    for (const value of ["someone@example.com", user.email.toUpperCase(), ` ${user.email} `]) {
      fireEvent.change(input, { target: { value } });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(commands.deleteUser).not.toHaveBeenCalled();
    }

    fireEvent.change(input, { target: { value: user.email } });
    expect(confirm).toBeEnabled();
    fireEvent.change(input, { target: { value: "" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: user.email } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(copy.commandSucceeded));
    expect(commands.deleteUser).toHaveBeenCalledExactlyOnceWith(user);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps deletion disabled while a command is pending", () => {
    const { user, copy, commands } = setup(locale, "delete", true);
    const input = screen.getByLabelText(copy.deleteEmailConfirmation, { exact: false });
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: user.email } });
    const confirm = screen.getByRole("button", { name: copy.confirm });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(commands.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ["reset-password", "resetPassword"],
    ["resend-invite", "resendInvite"],
    ["suspend", "suspendUser"],
    ["activate", "activateUser"],
    ["restore", "restoreUser"],
  ] as const)("keeps %s as a plain confirmation", async (action, command) => {
    const { user, copy, commands, onClose } = setup(locale, action);
    expect(screen.queryByLabelText(copy.deleteEmailConfirmation, { exact: false })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: copy.confirm });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(commands[command]).toHaveBeenCalledExactlyOnceWith(user);
    expect(commands.deleteUser).not.toHaveBeenCalled();
  });
});
