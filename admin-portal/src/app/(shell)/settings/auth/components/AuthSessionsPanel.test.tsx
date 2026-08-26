// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSessionSummary } from "@/lib/auth/sessionApi";
import { AuthSessionsPanel } from "./AuthSessionsPanel";

const state = vi.hoisted(() => ({
  hook: {} as Record<string, unknown>,
  revoke: vi.fn(),
  logoutEverywhere: vi.fn(),
  sessionsCopy: {
    title: "Sign-in sessions",
    description: "Session description",
    refresh: "Refresh sessions",
    loading: "Loading sign-in sessions...",
    error: "Session action failed.",
    current: "Current session",
    lastUsed: "Last used",
    refreshes: "Refreshes",
    accessIssuances: "Access issuances",
    endCurrent: "End this session",
    revoke: "Revoke session",
    empty: "No sessions available.",
    endCurrentTitle: "End the current session?",
    revokeTitle: "Revoke this sign-in session?",
    endCurrentDescription: "This browser will be signed out immediately.",
    revokeDescription: "That browser or device will lose access immediately.",
    endingCurrent: "Ending session...",
    revoking: "Revoking session...",
    logoutAllButton: "Sign out every device",
    logoutAllTitle: "End every session?",
    logoutAllDescription: "Every account session will end.",
    logoutAllTarget: "All account sessions",
    logoutAllConfirm: "End every session",
    logoutAllSubmitting: "Ending every session...",
  },
}));

vi.mock("../hooks/useAuthSessions", () => ({
  useAuthSessions: () => state.hook,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: { authActions: { sessions: state.sessionsCopy } },
  }),
}));

const remoteSession: AuthSessionSummary = {
  id: "019f0000-0000-7000-8000-000000000001",
  clientId: "mutakamel-admin-web",
  clientType: "WEB",
  deviceLabel: "Office browser",
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

describe("Admin auth session revocation", () => {
  beforeEach(() => {
    state.revoke.mockReset().mockResolvedValue(true);
    state.logoutEverywhere.mockReset().mockResolvedValue(true);
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
    render(<AuthSessionsPanel />);

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

  it("keeps current-session wording and disables closing while revocation is in flight", () => {
    const currentSession = { ...remoteSession, current: true };
    state.hook = hookState(currentSession);
    const view = render(<AuthSessionsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "End this session" }));
    expect(
      screen.getByRole("dialog", { name: "End the current session?" }),
    ).toBeInTheDocument();

    state.hook = hookState(currentSession, currentSession.id);
    view.rerender(<AuthSessionsPanel />);

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Ending session..." })).toBeDisabled();
  });

  it("requires confirmation before ending every account session", async () => {
    render(<AuthSessionsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out every device" }));

    expect(state.logoutEverywhere).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "End every session?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "End every session" }));

    await waitFor(() => expect(state.logoutEverywhere).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

function hookState(
  session: AuthSessionSummary,
  revokingId: string | null = null,
  isLoggingOutAll = false,
) {
  return {
    sessions: [session],
    isLoading: false,
    revokingId,
    isLoggingOutAll,
    error: null,
    reload: vi.fn(),
    revoke: state.revoke,
    logoutEverywhere: state.logoutEverywhere,
  };
}
