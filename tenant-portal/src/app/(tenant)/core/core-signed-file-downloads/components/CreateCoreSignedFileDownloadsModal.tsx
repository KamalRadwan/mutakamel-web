"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { bucket: string; year: string; month: string; filename: string; contentType: string; sizeKb: number }) => void;
}

export function CreateCoreSignedFileDownloadsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [bucket, setBucket] = useState("invoices");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("07");
  const [filename, setFilename] = useState("");
  const [contentType, setContentType] = useState("application/pdf");
  const [sizeKb, setSizeKb] = useState(150);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename) return;
    onSubmit({ bucket, year, month, filename, contentType, sizeKb: Number(sizeKb) });
    setFilename("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء رابط تحميل ملف موقع جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="اسم الحاوية (Bucket)"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          options={[
            { label: "invoices", value: "invoices" },
            { label: "contracts", value: "contracts" },
            { label: "export-reports", value: "export-reports" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="السنة" value={year} onChange={(e) => setYear(e.target.value)} required />
          <Input label="الشهر" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </div>
        <Input label="اسم الملف" placeholder="INV-2026-999.pdf" value={filename} onChange={(e) => setFilename(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="نوع الملف Content-Type" value={contentType} onChange={(e) => setContentType(e.target.value)} required />
          <Input label="الحجم (كيلوبايت)" type="number" value={sizeKb} onChange={(e) => setSizeKb(Number(e.target.value))} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">توليد الرابط الموقع</Button>
        </div>
      </form>
    </Modal>
  );
}
