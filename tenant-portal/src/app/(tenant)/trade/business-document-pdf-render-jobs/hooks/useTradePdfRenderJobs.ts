"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PdfRenderJobItem {
  id: string;
  documentType: "invoice" | "quotation" | "purchase_order" | "dispatch_note";
  referenceNumber: string;
  templateName: string;
  fileSize: string;
  renderedAt: string;
  status: "completed" | "processing" | "failed";
}

const mockPdfJobs: PdfRenderJobItem[] = [
  { id: "pdf-job-101", documentType: "invoice", referenceNumber: "INV-2026-8801", templateName: "ZATCA_Tax_Invoice_Standard.html", fileSize: "420 KB", renderedAt: "2026-07-25 10:15", status: "completed" },
  { id: "pdf-job-102", documentType: "quotation", referenceNumber: "QT-2026-302", templateName: "Commercial_Offer_B2B.html", fileSize: "1.2 MB", renderedAt: "2026-07-24 16:45", status: "completed" },
  { id: "pdf-job-103", documentType: "dispatch_note", referenceNumber: "DN-2026-091", templateName: "Warehouse_Dispatch_Slip.html", fileSize: "310 KB", renderedAt: "2026-07-25 11:00", status: "processing" },
];

export function useTradePdfRenderJobs() {
  const { t } = useI18n();
  const [items, setItems] = useState<PdfRenderJobItem[]>(mockPdfJobs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PdfRenderJobItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.documentType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PdfRenderJobItem, "id" | "fileSize" | "renderedAt" | "status">) => {
    const created: PdfRenderJobItem = {
      ...newItem,
      id: `pdf-job-${Date.now().toString().slice(-4)}`,
      fileSize: "جاري التوليد",
      renderedAt: "الآن",
      status: "processing",
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
