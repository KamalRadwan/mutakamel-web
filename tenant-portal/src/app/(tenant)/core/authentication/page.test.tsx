// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSessionItem } from "./hooks/useAuthenticationManagement";
import AuthenticationManagementPage from "./page";

const state = vi.hoisted(() => ({
  hook: {} as Record<string, unknown>,
  revoke: vi.fn(),
}));

vi.mock("./hooks/useAuthenticationManagement", () => ({
  useAuthenticationManagement: () => state.hook,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: { common: { cancel: "Cancel", confirmDelete: "Confirm", delete: "Delete", save: "Save" } },
  }),
}));

const remoteSession: AuthSessionItem = {
  id: "019f0000-0000-7000-8000-000000000002",
  clientId: "mutakamel-tenant-web",
  clientType: "WEB",
  deviceLabel: "Warehouse tablet",
  current: false,
  createdAt: "2026-08-11T10:00:00.000Z",
  lastRefreshAt: null,
  lastAccessIssuedAt: "2026-08-11T10:00:00.000Z",
  lastUserActivityAt: null,
  idleExpiresAt: "2026-08-11T10:30:00.000Z",
  absoluteExpiresAt: "2026-08-11T22:00:00.000Z",
  endedAt: null,
  endReason: null,
  refreshUseCount: "0",
  accessIssueCount: "1",
  credentialVersion: 1,
  sessionEpoch: 1,
};

describe("Tenant auth session revocation", () => {
  beforeEach(() => {
    state.revoke.mockReset().mockResolvedValue(true);
    state.hook = hookState(remoteSession);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires an accessible explicit confirmation before revoking a remote session", async () => {
    render(<AuthenticationManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke session" }));

    expect(state.revoke).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "Revoke this sign-in session?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke session" }));

    await waitFor(() => expect(state.revoke).toHaveBeenCalledWith(remoteSession));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps current-session wording and disables the dialog while revocation is in flight", () => {
    const currentSession = { ...remoteSession, current: true };
    state.hook = hookState(currentSession);
    const view = render(<AuthenticationManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: "End this session" }));
    expect(
      screen.getByRole("dialog", { name: "End the current session?" }),
    ).toBeInTheDocument();

    state.hook = hookState(currentSession, currentSession.id);
    view.rerender(<AuthenticationManagementPage />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(
      within(dialog).getByRole("button", { name: "Close confirmation" }),
    ).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Revoking..." })).toBeDisabled();
  });
});

function hookState(session: AuthSessionItem, revokingId: string | null = null) {
  return {
    lang: "en",
    items: [session],
    isLoading: false,
    error: null,
    revokingId,
    reload: vi.fn(),
    revoke: state.revoke,
  };
}
