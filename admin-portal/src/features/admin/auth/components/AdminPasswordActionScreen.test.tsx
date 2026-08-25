// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPasswordActionScreen } from "./AdminPasswordActionScreen";

const auth = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return {
    useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
  };
});

vi.mock("@/components/layout/LanguageToggle", () => ({
  LanguageToggle: () => null,
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

describe("public admin password actions", () => {
  beforeEach(() => {
    auth.acceptInvite.mockReset().mockResolvedValue(undefined);
    auth.resetPassword.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("strips the invite token fragment and submits the exact DTO only after validation", async () => {
    window.history.replaceState(
      {},
      "",
      "/admin/accept-invite#token=abcdefghijklmnop",
    );
    render(<AdminPasswordActionScreen mode="acceptInvite" />);

    const password = await screen.findByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    expect(window.location.hash).toBe("");

    fireEvent.change(password, { target: { value: "weak" } });
    fireEvent.change(confirmation, { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation and sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The password must satisfy every strength requirement shown above.",
    );
    expect(auth.acceptInvite).not.toHaveBeenCalled();

    fireEvent.change(password, { target: { value: "StrongPassword1!" } });
    fireEvent.change(confirmation, { target: { value: "StrongPassword1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation and sign in" }));

    await waitFor(() => expect(auth.acceptInvite).toHaveBeenCalledWith({
      token: "abcdefghijklmnop",
      newPassword: "StrongPassword1!",
    }));
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it("submits the reset-password DTO through the reset action", async () => {
    window.history.replaceState(
      {},
      "",
      "/admin/reset-password#token=qrstuvwxyzabcdef",
    );
    render(<AdminPasswordActionScreen mode="resetPassword" />);

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "AnotherStrong2@" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "AnotherStrong2@" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(auth.resetPassword).toHaveBeenCalledWith({
      token: "qrstuvwxyzabcdef",
      newPassword: "AnotherStrong2@",
    }));
    expect(auth.acceptInvite).not.toHaveBeenCalled();
  });

  it("shows an accessible recovery state when the fragment has no token", async () => {
    window.history.replaceState({}, "", "/admin/reset-password#ignored=value");
    render(<AdminPasswordActionScreen mode="resetPassword" />);

    expect(await screen.findByRole("heading", { name: "This link is incomplete" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" }))
      .toHaveAttribute("href", "/login");
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
});
