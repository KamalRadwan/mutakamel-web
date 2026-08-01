"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface NoteAttachmentItem {
  id: string;
  title: string;
  targetType: "lead" | "deal" | "customer";
  targetName: string;
  noteContent: string;
  attachmentName: string;
  fileSize: string;
  createdBy: string;
  createdAt: string;
}

const mockNotes: NoteAttachmentItem[] = [
  { id: "note-101", title: "I18N_FALLBACK", targetType: "deal", targetName: "I18N_FALLBACK", noteContent: "I18N_FALLBACK", attachmentName: "Technical_Proposal_v2.pdf", fileSize: "2.4 MB", createdBy: "I18N_FALLBACK", createdAt: "2026-07-22" },
  { id: "note-102", title: "I18N_FALLBACK", targetType: "customer", targetName: "I18N_FALLBACK", noteContent: "I18N_FALLBACK", attachmentName: "Commercial_CR_2026.pdf", fileSize: "1.1 MB", createdBy: "I18N_FALLBACK", createdAt: "2026-07-24" },
];

export function useCrmNotesAttachments() {
  const { t } = useI18n();
  const [items, setItems] = useState<NoteAttachmentItem[]>(mockNotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<NoteAttachmentItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.attachmentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<NoteAttachmentItem, "id" | "createdAt">) => {
    const created: NoteAttachmentItem = {
      ...newItem,
      id: `note-${Date.now().toString().slice(-4)}`,
      createdAt: "2026-07-25",
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
