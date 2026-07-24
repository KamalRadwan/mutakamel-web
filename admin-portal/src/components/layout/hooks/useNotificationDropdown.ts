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
  const [unreadCount, setUnreadCount] = useState(3);
  const { t } = useI18n();

  const notifications: NotificationItem[] = [
    {
      id: "1",
      title: "تم إنشاء مستأجر جديد",
      description: "تم قبول طلب تجهيز شركة Acme Retail LLC بنجاح.",
      time: "منذ 5 دقائق",
      type: "success",
      read: false,
    },
    {
      id: "2",
      title: "تنبيه سعة السيرفر",
      description: "السيرفر DB-PRIMARY-01 وصل إلى 85% من سعة المستأجرين.",
      time: "منذ 25 دقيقة",
      type: "warning",
      read: false,
    },
    {
      id: "3",
      title: "تم إصدار فاتورة شهرية",
      description: "تم توليد الفاتورة #INV-2026-089 بقيمة $299.00.",
      time: "منذ ساعة",
      type: "info",
      read: false,
    },
  ];

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
