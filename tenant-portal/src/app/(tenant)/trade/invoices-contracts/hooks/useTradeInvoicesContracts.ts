"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface InvoiceContractItem {
  id: string;
  documentNumber: string;
  documentType: "invoice" | "contract" | "credit_note";
  customerName: string;
  totalAmount: string;
  taxAmount: string;
  issueDate: string;
  paymentStatus: "paid" | "partially_paid" | "unpaid" | "overdue";
}

const mockInvoices: InvoiceContractItem[] = [
  { id: "inv-tr-501", documentNumber: "INV-2026-9011", documentType: "invoice", customerName: "مستشفى السلام الدولي", totalAmount: "138,000.00 SAR", taxAmount: "18,000.00 SAR", issueDate: "2026-07-20", paymentStatus: "paid" },
  { id: "inv-tr-502", documentNumber: "CNT-2026-0042", documentType: "contract", customerName: "شركة المتحدون للتجارة", totalAmount: "450,000.00 SAR", taxAmount: "58,695.65 SAR", issueDate: "2026-07-22", paymentStatus: "partially_paid" },
  { id: "inv-tr-503", documentNumber: "INV-2026-9015", documentType: "invoice", customerName: "مجموعات التجزئة المتقدمة", totalAmount: "42,500.00 SAR", taxAmount: "5,543.48 SAR", issueDate: "2026-07-24", paymentStatus: "overdue" },
];

export function useTradeInvoicesContracts() {
  const { t } = useI18n();
  const [items, setItems] = useState<InvoiceContractItem[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<InvoiceContractItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<InvoiceContractItem, "id" | "paymentStatus">) => {
    const created: InvoiceContractItem = {
      ...newItem,
      id: `inv-tr-${Date.now().toString().slice(-4)}`,
      paymentStatus: "unpaid",
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
