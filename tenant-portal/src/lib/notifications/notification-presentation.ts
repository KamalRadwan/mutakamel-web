import { auditNotificationText } from "@/lib/audit/notification-text";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";

interface NotificationContent {
  id: string; notificationType: string; title: string; body: string;
  entityType: string | null; entityId: string | null; actionUrl: string | null;
  metadata: Readonly<Record<string, unknown>>;
}

interface ReminderCopy {
  reminderTitle: string; reminderDue: string; reminderOffset: string; reminderLocation: string;
}

export function notificationHref(item: Pick<NotificationContent, "id" | "notificationType" | "entityType" | "entityId" | "actionUrl">): string {
  if (item.entityType === "activity" && isUUIDv7(item.entityId)) {
    return `/core/activities?activityId=${item.entityId}`;
  }
  return item.actionUrl ?? `/core/notifications/${item.id}`;
}

export function notificationText(
  item: NotificationContent,
  auditCopy: Parameters<typeof auditNotificationText>[1],
  copy: ReminderCopy,
  activityTypes: Readonly<Record<string, string>>,
  locale: string,
): { title: string; body: string } {
  if (item.notificationType !== "core.activity.reminder") return auditNotificationText(item, auditCopy);
  const metadata = item.metadata;
  const subject = typeof metadata.activitySubject === "string" ? metadata.activitySubject.trim() : "";
  const type = typeof metadata.activityType === "string" ? activityTypes[metadata.activityType] : undefined;
  const dueAt = typeof metadata.dueAt === "string" ? new Date(metadata.dueAt) : null;
  const due = dueAt && Number.isFinite(dueAt.getTime())
    ? formatTemplate(copy.reminderDue, { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(dueAt) })
    : null;
  const offset = typeof metadata.reminderOffsetMinutes === "number" && Number.isInteger(metadata.reminderOffsetMinutes) && metadata.reminderOffsetMinutes >= 0
    ? formatTemplate(copy.reminderOffset, { minutes: new Intl.NumberFormat(locale).format(metadata.reminderOffsetMinutes) }) : null;
  const location = typeof metadata.location === "string" && metadata.location.trim()
    ? formatTemplate(copy.reminderLocation, { location: metadata.location }) : null;
  const description = typeof metadata.descriptionPreview === "string" ? metadata.descriptionPreview : null;
  return {
    title: subject ? `${copy.reminderTitle} · ${subject}` : copy.reminderTitle,
    body: [type, due, offset, location, description].filter(Boolean).join("\n") || item.body,
  };
}
