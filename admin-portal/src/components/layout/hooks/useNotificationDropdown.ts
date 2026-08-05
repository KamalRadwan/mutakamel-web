"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "success" | "warning" | "info";
  read: boolean;
}

export function useNotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useI18n();

  const notifications: NotificationItem[] = [];

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);
  const markAllRead = () => setUnreadCount(0);

  return {
    t,
    isOpen,
    unreadCount,
    notifications,
    toggleOpen,
    close,
    markAllRead,
  };
}
