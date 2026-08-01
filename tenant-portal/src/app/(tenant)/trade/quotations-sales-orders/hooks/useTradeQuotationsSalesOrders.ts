"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface QuotationSalesOrderItem {
  id: string;
  orderNumber: string;
  type: "sales_quotation" | "sales_order";
  customerName: string;
  totalAmount: string;
  itemsCount: number;
  validityOrDeliveryDate: string;
  status: "draft" | "sent_to_customer" | "confirmed_order" | "fulfilled";
}

const mockOrders: QuotationSalesOrderItem[] = [
  { id: "so-tr-101", orderNumber: "SO-2026-8801", type: "sales_order", customerName: "مستشفى السلام الدولي", totalAmount: "138,000.00 SAR", itemsCount: 12, validityOrDeliveryDate: "2026-08-01", status: "confirmed_order" },
  { id: "so-tr-102", orderNumber: "QT-2026-4099", type: "sales_quotation", customerName: "شركة المتحدون للتجارة", totalAmount: "95,000.00 SAR", itemsCount: 5, validityOrDeliveryDate: "2026-08-15", status: "sent_to_customer" },
];

export function useTradeQuotationsSalesOrders() {
  const { t } = useI18n();
  const [items, setItems] = useState<QuotationSalesOrderItem[]>(mockOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<QuotationSalesOrderItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<QuotationSalesOrderItem, "id" | "itemsCount" | "status">) => {
    const created: QuotationSalesOrderItem = {
      ...newItem,
      id: `so-tr-${Date.now().toString().slice(-4)}`,
      itemsCount: 3,
      status: newItem.type === "sales_order" ? "confirmed_order" : "sent_to_customer",
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
