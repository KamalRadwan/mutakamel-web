import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { INTL_LOCALE } from "@/lib/format/locale";
import { notificationHref, notificationText } from "./notification-presentation";

const activityId = "01a1a837-8914-772c-8a5f-fa70a9028b74";
const item = { id: activityId, notificationType: "core.activity.reminder", title: "Activity reminder", body: "Saved body",
  entityType: "activity", entityId: activityId, actionUrl: null,
  metadata: { activitySubject: "Discuss proposal", activityType: "CALL", dueAt: "2026-11-04T20:22:00Z",
    reminderOffsetMinutes: 2, location: "Main office", descriptionPreview: "Review pricing" } };

describe("notification presentation", () => {
  it.each(["en", "ar"] as const)("shows the subject, translated type, local date, offset and details in %s", (lang) => {
    const t = { en, ar }[lang];
    const result = notificationText(item, t.audit.recordMessages, t.coreNotifications, t.activities.types, INTL_LOCALE[lang]);
    expect(result.title).toContain("Discuss proposal");
    for (const text of [t.activities.types.CALL, "Main office", "Review pricing", "2"]) expect(result.body).toContain(text);
    expect(result.body).not.toContain("T20:22");
    expect(result.body).not.toContain("undefined");
  });
  it("opens old and new activity reminders directly even when already read or missing an action URL", () => {
    expect(notificationHref(item)).toBe(`/core/activities?activityId=${activityId}`);
    expect(notificationHref({ ...item, entityId: "invalid" })).toBe(`/core/notifications/${activityId}`);
    expect(notificationHref({ ...item, entityType: "lead", actionUrl: "/crm/leads" })).toBe("/crm/leads");
  });
  it("handles older reminder metadata and corrupt dates without crashing", () => {
    const result = notificationText({ ...item, metadata: { dueAt: "invalid" } }, en.audit.recordMessages, en.coreNotifications, en.activities.types, INTL_LOCALE.en);
    expect(result).toEqual({ title: en.coreNotifications.reminderTitle, body: item.body });
  });
});
