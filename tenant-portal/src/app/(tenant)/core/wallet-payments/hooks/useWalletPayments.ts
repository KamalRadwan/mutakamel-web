"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TransactionItem {
  id: string;
  txNumber: string;
  type: "deposit" | "withdrawal" | "charge";
  amount: string;
  currency: string;
  paymentGateway: string;
  createdAt: string;
  status: "success" | "pending" | "failed";
}

const mockTxs: TransactionItem[] = [
  { id: "tx-101", txNumber: "TX-2026-901", type: "deposit", amount: "5,000.00", currency: "USD", paymentGateway: "Stripe Credit Card", createdAt: "2026-07-20 14:00", status: "success" },
  { id: "tx-102", txNumber: "TX-2026-902", type: "charge", amount: "1,200.00", currency: "USD", paymentGateway: "Internal Wallet", createdAt: "2026-07-22 09:30", status: "success" },
  { id: "tx-103", txNumber: "TX-2026-903", type: "deposit", amount: "2,500.00", currency: "USD", paymentGateway: "Bank Wire Transfer", createdAt: "2026-07-25 11:15", status: "pending" },
];

export function useWalletPayments() {
  const { t } = useI18n();
  const [items, setItems] = useState<TransactionItem[]>(mockTxs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<TransactionItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.txNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.paymentGateway.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<TransactionItem, "id" | "createdAt" | "status">) => {
    const created: TransactionItem = {
      ...newItem,
      id: `tx-${Date.now().toString().slice(-4)}`,
      createdAt: "الآن",
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
