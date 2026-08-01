"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface SignedFileItem {
  id: string;
  bucket: string;
  year: string;
  month: string;
  filename: string;
  contentType: string;
  sizeKb: number;
  expiresAt: string;
  status: "active" | "expired";
}

const mockFiles: SignedFileItem[] = [
  { id: "file-101", bucket: "invoices", year: "2026", month: "07", filename: "INV-2026-001.pdf", contentType: "application/pdf", sizeKb: 245, expiresAt: "2026-07-28 14:00", status: "active" },
  { id: "file-102", bucket: "contracts", year: "2026", month: "06", filename: "MSA-Mutakamel.pdf", contentType: "application/pdf", sizeKb: 1024, expiresAt: "2026-07-25 10:00", status: "expired" },
  { id: "file-103", bucket: "export-reports", year: "2026", month: "07", filename: "leads-export-q2.csv", contentType: "text/csv", sizeKb: 89, expiresAt: "2026-07-30 18:30", status: "active" },
];

export function useCoreSignedFileDownloads() {
  const { t } = useI18n();
  const [items, setItems] = useState<SignedFileItem[]>(mockFiles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFileForDelete, setSelectedFileForDelete] = useState<SignedFileItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bucket.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newFile: Omit<SignedFileItem, "id" | "expiresAt" | "status">) => {
    const created: SignedFileItem = {
      ...newFile,
      id: `file-${Date.now().toString().slice(-4)}`,
      expiresAt: "2026-08-01 12:00",
      status: "active",
    };
    setItems((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  };

  const handleDelete = () => {
    if (selectedFileForDelete) {
      setItems((prev) => prev.filter((i) => i.id !== selectedFileForDelete.id));
      setSelectedFileForDelete(null);
    }
  };

  return {
    t,
    items: filteredItems,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedFileForDelete,
    setSelectedFileForDelete,
    handleCreate,
    handleDelete,
  };
}
