"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface HostStatusItem {
  id: string;
  fqdn: string;
  subdomain: string;
  sslStatus: "valid" | "renewing" | "expired";
  healthCheck: "healthy" | "degraded" | "down";
  ipAddress: string;
  lastChecked: string;
}

const mockHosts: HostStatusItem[] = [
  { id: "host-1", fqdn: "tenant.mutakamel.ai", subdomain: "tenant", sslStatus: "valid", healthCheck: "healthy", ipAddress: "167.99.12.34", lastChecked: "منذ دقيقة" },
  { id: "host-2", fqdn: "app.crowdcapital.sa", subdomain: "app", sslStatus: "renewing", healthCheck: "healthy", ipAddress: "167.99.12.35", lastChecked: "منذ 5 دقائق" },
  { id: "host-3", fqdn: "dev-tenant.mutakamel.ai", subdomain: "dev-tenant", sslStatus: "valid", healthCheck: "degraded", ipAddress: "167.99.12.39", lastChecked: "منذ 10 دقائق" },
];

export function useHostStatus() {
  const { t } = useI18n();
  const [items, setItems] = useState<HostStatusItem[]>(mockHosts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<HostStatusItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.fqdn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<HostStatusItem, "id" | "lastChecked">) => {
    const created: HostStatusItem = {
      ...newItem,
      id: `host-${Date.now().toString().slice(-4)}`,
      lastChecked: "الآن",
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
