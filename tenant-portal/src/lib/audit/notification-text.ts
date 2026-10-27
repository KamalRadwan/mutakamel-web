import { formatTemplate } from "@/lib/format/template";

interface RecordMessageCopy {
  ownerChangedTitle: string; ownerChangedBody: string;
  deletedTitle: string; deletedBody: string; unnamed: string;
}

// BaseTenantRepository publishes metadata.params as JSON in a scalar string.
// Only the two known message keys are interpolated; unknown or malformed
// messages keep the server text. React renders these strings as text, never HTML.
export function auditNotificationText(
  notification: { title: string; body: string; metadata: Readonly<Record<string, unknown>> },
  copy: RecordMessageCopy,
): { title: string; body: string } {
  const { messageKey, params } = notification.metadata;
  if (messageKey !== "record.owner_changed" && messageKey !== "record.deleted") return notification;
  if (typeof params !== "string" || params.length > 512) return notification;
  try {
    const decoded: unknown = JSON.parse(params);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return notification;
    const label = (decoded as Record<string, unknown>).entityLabel;
    if (typeof label !== "string") return notification;
    const deleted = messageKey === "record.deleted";
    return {
      title: deleted ? copy.deletedTitle : copy.ownerChangedTitle,
      body: formatTemplate(deleted ? copy.deletedBody : copy.ownerChangedBody, { entityLabel: label || copy.unnamed }),
    };
  } catch { return notification; }
}
