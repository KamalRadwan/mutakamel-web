"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  planName: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
}

const mockInvoices: InvoiceItem[] = [
  { id: "inv-001", invoiceNumber: "INV-2026-7001", planName: "الخطة الاحترافية (Enterprise Plan)", amount: "1,200.00", currency: "USD", issueDate: "2026-07-01", dueDate: "2026-07-15", status: "paid" },
  { id: "inv-002", invoiceNumber: "INV-2026-7002", planName: "ترقية موديول CRM", amount: "350.00", currency: "USD", issueDate: "2026-07-20", dueDate: "2026-08-05", status: "pending" },
  { id: "inv-003", invoiceNumber: "INV-2026-6099", planName: "رسوم الخادم المخصص", amount: "500.00", currency: "USD", issueDate: "2026-06-01", dueDate: "2026-06-15", status: "overdue" },
];

export function useBillingInvoicesSubscription() {
  const { t } = useI18n();
  const [items, setItems] = useState<InvoiceItem[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<InvoiceItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.planName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<InvoiceItem, "id" | "status">) => {
    const created: InvoiceItem = {
      ...newItem,
      id: `inv-${Date.now().toString().slice(-4)}`,
      status: "pending",
    };
    setItems((prev) => [created, ...prev]);
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
