// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import { NotificationsDropdown } from "./NotificationsDropdown";

let dictionary: Dictionary = en;
let language: "en" | "ar" = "en";
let notificationsAuthorized = true;
const generation = "tenant:session:user";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => language }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      permissions: notificationsAuthorized ? ["notifications.notification.read"] : [],
      permissionScopes: notificationsAuthorized
        ? { "notifications.notification.read": { tenantWide: true, companyIds: [], branchIds: [] } }
        : {},
    },
  }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  dictionary = en;
  language = "en";
  notificationsAuthorized = true;
  tenantNotificationRuntime.bindGeneration(generation);
});

afterEach(() => {
  cleanup();
  tenantNotificationRuntime.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openBell() {
  fireEvent.click(screen.getByRole("button", { name: dictionary.common.notifications }));
}

describe("NotificationsDropdown REST recovery", () => {
  it.each(["en", "ar"] as const)("labels retained rows as stale while refreshing and after failure in %s", async (locale) => {
    language = locale;
    dictionary = { en, ar }[locale];
    tenantNotificationRuntime.replaceAfterResync(
      generation, [notification()], 9, 1, "2026-08-14T10:00:00.000Z", null,
      tenantNotificationRuntime.getSnapshot().revision,
    );
    tenantNotificationRuntime.setLoadState(generation, "ready");
    let reject!: (error: Error) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((_resolve, fail) => { reject = fail; })));
    render(<NotificationsDropdown />);
    fireEvent.click(screen.getByRole("button", { name: `${dictionary.common.notifications}, 9` }));
    await waitFor(() => expect(reject).toBeTypeOf("function"));
    expect(screen.getByText(dictionary.errors.notificationCacheStale, { exact: false })).toHaveTextContent(dictionary.common.loading);
    expect(screen.getByText("Existing notification")).toBeInTheDocument();
    await act(async () => { reject(new TypeError("REST unavailable")); });
    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.errors.notificationLoadFailed);
    expect(screen.getByText(dictionary.errors.notificationCacheStale)).toHaveAttribute("role", "status");
    expect(screen.getByText("Existing notification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: dictionary.common.retry })).toBeEnabled();
    expect(screen.queryByText(dictionary.common.noData)).not.toBeInTheDocument();
  });

  it("hides the bell without read access and unmounts it when access is removed", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    notificationsAuthorized = false;
    const view = render(<NotificationsDropdown />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    notificationsAuthorized = true;
    view.rerender(<NotificationsDropdown />);
    expect(screen.getByRole("button", { name: dictionary.common.notifications })).toBeInTheDocument();
    notificationsAuthorized = false;
    view.rerender(<NotificationsDropdown />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)("shows loading, a recoverable error and successful retry in %s", async (locale) => {
    language = locale;
    dictionary = { en, ar }[locale];
    let reject!: (error: Error) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((_resolve, fail) => { reject = fail; }))
      .mockImplementation(() => Promise.resolve(pageResponse([notification()], 9)));
    vi.stubGlobal("fetch", fetcher);
    render(<NotificationsDropdown />);
    openBell();

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(screen.getByText(dictionary.common.loading)).toHaveAttribute("role", "status");
    expect(screen.queryByText(dictionary.common.noData)).not.toBeInTheDocument();
    await act(async () => { reject(new TypeError("REST unavailable")); });

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.errors.notificationLoadFailed);
    expect(screen.queryByText(dictionary.common.noData)).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: dictionary.common.retry });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);

    expect(await screen.findByText("Existing notification")).toBeInTheDocument();
    expect(screen.getByLabelText(`${dictionary.common.notifications}, 9`, { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("renders an empty inbox only after a successful REST load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(pageResponse([], 0))));
    render(<NotificationsDropdown />);
    openBell();
    expect(await screen.findByText(en.common.noData)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps cached notifications and the authoritative badge after a refresh failure", async () => {
    tenantNotificationRuntime.replaceAfterResync(
      generation, [notification()], 9, 1, "2026-08-14T10:00:00.000Z", null,
      tenantNotificationRuntime.getSnapshot().revision,
    );
    tenantNotificationRuntime.setLoadState(generation, "ready");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("REST unavailable")));
    render(<NotificationsDropdown />);
    fireEvent.click(screen.getByRole("button", { name: `${en.common.notifications}, 9` }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors.notificationLoadFailed);
    expect(screen.getByText("Existing notification")).toBeInTheDocument();
    expect(screen.getByLabelText(`${en.common.notifications}, 9`, { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByText(en.common.noData)).not.toBeInTheDocument();
  });

  it("offers no notification reads when no authorized generation is bound", () => {
    tenantNotificationRuntime.clear();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<NotificationsDropdown />);
    expect(screen.queryByRole("button", { name: en.common.notifications })).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("renders the permission boundary for an authoritative REST denial", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ message: "Forbidden" }),
      { status: 403, headers: { "content-type": "application/json" } },
    ))));
    render(<NotificationsDropdown />);
    openBell();
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText(en.common.noData)).not.toBeInTheDocument();
    expect(screen.queryByText(en.errors.notificationLoadFailed)).not.toBeInTheDocument();
  });
});

describe("NotificationsDropdown accessibility", () => {
  it.each(["en", "ar"] as const)("labels the dialog and restores focus after Escape in %s", async (locale) => {
    language = locale;
    dictionary = { en, ar }[locale];
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(pageResponse([notification()], 1))));
    render(<NotificationsDropdown />);
    const trigger = screen.getByRole("button", { name: dictionary.common.notifications });
    trigger.focus();
    // Native buttons emit a click for Enter/Space; jsdom does not synthesize it.
    fireEvent.click(trigger);

    const panel = await screen.findByRole("dialog", { name: dictionary.common.notifications });
    const heading = within(panel).getByRole("heading", { name: dictionary.common.notifications });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    await screen.findByText("Existing notification");
    expect(heading).toHaveFocus();

    const actions = within(panel).getAllByRole("button");
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action).toBeEnabled();
      expect(action.tabIndex).toBe(0);
      action.focus();
      expect(action).toHaveFocus();
    }
    actions[0].focus();
    expect(fireEvent.keyDown(actions[0], { key: "Tab" })).toBe(true);
    actions[1].focus();
    expect(fireEvent.keyDown(actions[1], { key: "Tab", shiftKey: true })).toBe(true);

    fireEvent.keyDown(actions[1], { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it.each(["empty", "forbidden", "error"] as const)("provides initial focus for an %s inbox", async (state) => {
    vi.stubGlobal("fetch", vi.fn(() => state === "error"
      ? Promise.reject(new TypeError("REST unavailable"))
      : Promise.resolve(state === "forbidden"
        ? new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403, headers: { "content-type": "application/json" },
        })
        : pageResponse([], 0))));
    render(<NotificationsDropdown />);
    openBell();
    const panel = await screen.findByRole("dialog", { name: en.common.notifications });
    await waitFor(() => expect(within(panel).getByRole("heading")).toHaveFocus());
    if (state === "empty") await screen.findByText(en.common.noData);
    if (state === "forbidden") await screen.findByText(en.permissionGate.title);
    if (state === "error") await screen.findByRole("button", { name: en.common.retry });
    expect(within(panel).getByRole("heading")).toHaveFocus();
  });
});

function notification() {
  return {
    id: "019ff4ca-b3c1-73a3-b27e-000000000001",
    recipientId: "019ff4ca-b3c1-73a3-b27e-000000000002",
    sourceApp: "core-app", notificationType: "tenant.test", priority: "P2_NORMAL",
    title: "Existing notification", body: "Saved notification body", actionUrl: null,
    entityType: null, entityId: null, channels: ["IN_APP"], metadata: {},
    createdAt: "2026-08-14T10:00:00.000Z", readAt: null, acknowledgedAt: null,
    deliveredAt: null, recipientStateVersion: 0,
  };
}

function pageResponse(items: ReturnType<typeof notification>[], unreadCount: number): Response {
  return new Response(JSON.stringify({ success: true, data: {
    items, unreadCount, unreadRevision: 1, unreadChangedAt: "2026-08-14T10:00:00.000Z",
    nextCursor: null, hasNext: false,
  } }), { status: 200, headers: { "content-type": "application/json" } });
}
