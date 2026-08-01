"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface NotificationConfigItem {
  id: string;
  channel: string;
  senderEmail: string;
  smtpHost: string;
  port: number;
  status: "verified" | "unverified";
}

const mockConfigs: NotificationConfigItem[] = [
  { id: "cfg-1", channel: "البريد الإلكتروني الرئيسي (SMTP)", senderEmail: "noreply@tenant.mutakamel.ai", smtpHost: "smtp.mailgun.org", port: 587, status: "verified" },
  { id: "cfg-2", channel: "إشعارات الجوال Push Notifications", senderEmail: "fcm-gateway@mutakamel.ai", smtpHost: "fcm.googleapis.com", port: 443, status: "verified" },
  { id: "cfg-3", channel: "خادم بريد الدعم المساعد", senderEmail: "support@tenant.mutakamel.ai", smtpHost: "smtp.office365.com", port: 587, status: "unverified" },
];

export function useNotificationsEmailConfig() {
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationConfigItem[]>(mockConfigs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<NotificationConfigItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.senderEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<NotificationConfigItem, "id" | "status">) => {
    const created: NotificationConfigItem = {
      ...newItem,
      id: `cfg-${Date.now().toString().slice(-4)}`,
      status: "unverified",
    };
    setItems((prev) => [...prev, created]);
    setIsCreateOpen(false);
  };

  const handleDelete = () => {
    if (selectedForDelete) {
      setItems((prev) => prev.filter((i) => i.id !== selectedForDelete.id));
      setSelectedForDelete(null);
    }
  };

  return {
    t,
    items: filteredItems,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  };
}
