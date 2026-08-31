// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import type { AuthSessionItem } from "./hooks/useAuthenticationManagement";
import AuthenticationManagementPage from "./page";

function renderPage() {
  return render(
    <TooltipProvider>
      <AuthenticationManagementPage />
    </TooltipProvider>,
  );
}

const state = vi.hoisted(() => ({
  hook: {} as Record<string, unknown>,
  revoke: vi.fn(),
}));

const t = {
  common: {
    cancel: "Cancel",
    retry: "Retry",
    actions: "Actions",
    previousPage: "Previous page",
    nextPage: "Next page",
    showingOf: "Showing {from}–{to} of {total}",
  },
  authSessions: {
    title: "Sign-in sessions",
    subtitle: "subtitle",
    refresh: "Refresh",
    loadFailed: "The sessions could not be loaded or revoked. Try again.",
    empty: "No sessions available.",
    thisDevice: "This device",
    ended: "Ended",
    columnDevice: "Device",
    columnClientType: "Client",
    columnLastActivity: "Last activity",
    columnCreated: "Created",
    columnActions: "Actions",
    endThisSession: "End this session",
    revokeSession: "Revoke session",
    confirmEndTitle: "End the current session?",
    confirmEndMessage: "This browser will be signed out immediately. Other sessions remain active.",
    confirmRevokeTitle: "Revoke this sign-in session?",
    confirmRevokeMessage: "That browser or device will lose access immediately.",
    confirmLoading: "Revoking…",
    clientTypeWeb: "Web",
    clientTypeIos: "iOS",
    clientTypeAndroid: "Android",
    clientTypeDesktop: "Desktop",
  },
};

vi.mock("./hooks/useAuthenticationManagement", () => ({
  useAuthenticationManagement: () => state.hook,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t }),
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires an accessible explicit confirmation before revoking a remote session", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Revoke session" }));

    expect(state.revoke).not.toHaveBeenCalled();
    // ConfirmActionModal is built on Radix AlertDialog, which renders
    // role="alertdialog" — a destructive confirmation, not a plain dialog.
    const dialog = screen.getByRole("alertdialog", {
      name: "Revoke this sign-in session?",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke session" }));

    await waitFor(() => expect(state.revoke).toHaveBeenCalledWith(remoteSession));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps current-session wording and disables the dialog while revocation is in flight", () => {
    const currentSession = { ...remoteSession, current: true };
    state.hook = hookState(currentSession);
    const view = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "End this session" }));
    expect(
      screen.getByRole("alertdialog", { name: "End the current session?" }),
    ).toBeInTheDocument();

    state.hook = hookState(currentSession, currentSession.id);
    view.rerender(
      <TooltipProvider>
        <AuthenticationManagementPage />
      </TooltipProvider>,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "End this session" })).toBeDisabled();
  });

  it("never shows the raw wire client type — always the translated label", () => {
    state.hook = hookState(remoteSession);
    renderPage();
    expect(screen.getByText("Web")).toBeInTheDocument();
    expect(screen.queryByText("WEB")).toBeNull();
  });
});

function hookState(session: AuthSessionItem, revokingId: string | null = null) {
  return {
    t,
    lang: "en",
    items: [session],
    isLoading: false,
    error: null,
    revokingId,
    reload: vi.fn(),
    revoke: state.revoke,
  };
}
