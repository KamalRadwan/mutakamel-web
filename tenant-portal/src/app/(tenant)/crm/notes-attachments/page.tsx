"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileText, Paperclip, Download } from "lucide-react";
import { useCrmNotesAttachments, NoteAttachmentItem } from "./hooks/useCrmNotesAttachments";
import { CreateCrmNotesAttachmentsModal } from "./components/CreateCrmNotesAttachmentsModal";
import { DeleteCrmNotesAttachmentsConfirmModal } from "./components/DeleteCrmNotesAttachmentsConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmNotesAttachmentsPage() {
//     const { t } = useI18n();
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = useCrmNotesAttachments();

  const columns = [
    {
      header: t.crm.noteTitleAndEntity,
      cell: (item: NoteAttachmentItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-[11px] text-slate-400">{item.targetName} ({item.targetType.toUpperCase()})</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.attachedFile,
      cell: (item: NoteAttachmentItem) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-blue-600 dark:text-blue-400">
          <Paperclip className="w-3.5 h-3.5" />
          <span>{item.attachmentName}</span>
          <span className="text-[10px] text-slate-400">({item.fileSize})</span>
        </div>
      ),
    },
    { header: t.crm.constructor, accessorKey: "createdBy" as keyof NoteAttachmentItem },
    { header: t.crm.theDate, accessorKey: "createdAt" as keyof NoteAttachmentItem },
    {
      header: t.crm.procedures,
      cell: (item: NoteAttachmentItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/notes-attachments/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.cRMNotesAttachments}
        subtitle={t.crm.recordAttachedTechnicalNote}
        actionLabel={t.crm.addANewNote}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchBySizeTitleOrFile}
      />

      <Table columns={columns} data={items} />

      <CreateCrmNotesAttachmentsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmNotesAttachmentsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
