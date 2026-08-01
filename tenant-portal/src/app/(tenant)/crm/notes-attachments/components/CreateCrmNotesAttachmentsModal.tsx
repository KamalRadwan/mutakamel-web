"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; targetType: "lead" | "deal" | "customer"; targetName: string; noteContent: string; attachmentName: string; fileSize: string; createdBy: string }) => void;
}

export function CreateCrmNotesAttachmentsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState<"lead" | "deal" | "customer">("deal");
  const [targetName, setTargetName] = useState("صفقة مستشفى الحياة");
  const [noteContent, setNoteContent] = useState("");
  const [attachmentName, setAttachmentName] = useState("Document_V1.pdf");
  const [fileSize, setFileSize] = useState("1.5 MB");
  const [createdBy, setCreatedBy] = useState("أحمد محمود");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({ title, targetType, targetName, noteContent, attachmentName, fileSize, createdBy });
    setTitle("");
    setNoteContent("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة ملاحظة ومرفق جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان الملاحظة" placeholder="مثال: تفاصيل الاجتماع الفني" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="الكيان المرتبط"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as any)}
            options={[
              { label: "صفقة (Deal)", value: "deal" },
              { label: "عميل محتمل (Lead)", value: "lead" },
              { label: "ملف عميل (Customer)", value: "customer" },
            ]}
          />
          <Input label="اسم الكيان" value={targetName} onChange={(e) => setTargetName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">محتوى الملاحظة</label>
          <textarea
            rows={3}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="اسم الملف المرفق" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} required />
          <Input label="حجم الملف" value={fileSize} onChange={(e) => setFileSize(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الملاحظة</Button>
        </div>
      </form>
    </Modal>
  );
}
