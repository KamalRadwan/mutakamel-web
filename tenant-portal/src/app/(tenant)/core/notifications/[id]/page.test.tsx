// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import { resetWireLabelWarnings } from "@/lib/format/wire-label";
import type { InboxNotification } from "../notification-contract";
import NotificationDetailPage from "./page";

const state = vi.hoisted(() => ({ hook: {} as Record<string, unknown> }));

vi.mock("./hooks/useNotificationDetail", () => ({
  useNotificationDetail: () => state.hook,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "019efef0-0000-7000-8000-000000000001" }),
}));
vi.mock("../components/NotificationList", () => ({ PriorityBadge: () => null }));
vi.mock("@/design-system", () => {
  const Content = ({ children }: { children?: ReactNode }) => <span>{children}</span>;
  return {
    Badge: Content, Button: Content, Card: Content, CardContent: Content,
    CardHeader: Content, CardTitle: Content, IdentifierText: Content,
    PermissionGate: Content,
    PageHeader: () => null, DateTime: () => null, ErrorState: () => null,
    NotFoundState: () => null, Skeleton: () => null,
  };
});

function renderChannel(t: typeof en | typeof ar, lang: "en" | "ar", channel: string) {
  const notification: InboxNotification = {
    id: "019efef0-0000-7000-8000-000000000001",
    recipientId: "019efef0-0000-7000-8000-000000000009",
    sourceApp: "crm", notificationType: "crm.task.assigned", priority: "P2_NORMAL",
    title: "Notification", body: "Body", actionUrl: null,
    entityType: null, entityId: null, channels: [channel], metadata: {},
    createdAt: "2026-10-17T12:00:00.000Z", readAt: null,
    acknowledgedAt: null, deliveredAt: null, recipientStateVersion: 0,
  };
  state.hook = {
    t, lang, notification, status: "found", error: null, isPending: false,
    markRead: vi.fn(), acknowledge: vi.fn(), dismiss: vi.fn(), reload: vi.fn(),
  };
  return render(<NotificationDetailPage />);
}

afterEach(() => {
  cleanup();
  resetWireLabelWarnings();
  vi.restoreAllMocks();
});

describe.each([
  { lang: "en" as const, t: en, expected: "In-app" },
  { lang: "ar" as const, t: ar, expected: "داخل التطبيق" },
])("notification channel labels ($lang)", ({ lang, t, expected }) => {
  it("renders canonical IN_APP without an unknown-code warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderChannel(t, lang, "IN_APP");

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(formatTemplate(t.common.unknownCode, { code: "IN_APP" }))).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["UNSUPPORTED_CHANNEL", "PUSH", "EMAIL", "inApp"])(
    "keeps the controlled fallback for %s instead of treating it as a supported wire value",
    (channel) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const view = renderChannel(t, lang, channel);

      expect(screen.getByText(formatTemplate(t.common.unknownCode, { code: channel }))).toBeInTheDocument();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`coreNotifications.wireChannelNames.${channel}`));
      view.rerender(<NotificationDetailPage />);
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );
});
