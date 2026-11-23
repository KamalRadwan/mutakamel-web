export interface NotificationsUnreadState {
  unreadCount: number;
  unreadRevision: number | null;
  at: number;
}

export type NotificationsFeedEvent =
  | { kind: 'created'; notificationId: string }
  | {
      kind: 'updated';
      notificationId: string;
      change: 'READ' | 'ACKNOWLEDGED' | 'DISMISSED';
      readAt: string | null;
      acknowledgedAt: string | null;
      recipientStateVersion: number;
    }
  | { kind: 'sync' };
