"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { leadName: string; company: string; email: string; phone: string; source: string; stage: string; assignedTo: string }) => void;
}

export function CreateLeadsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [leadName, setLeadName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Google Ads");
  const [stage, setStage] = useState("عميل محتمل جديد");
  const [assignedTo, setAssignedTo] = useState("أحمد محمود");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !company) return;
    onSubmit({ leadName, company, email, phone, source, stage, assignedTo });
    setLeadName("");
    setCompany("");
    setEmail("");
    setPhone("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة عميل محتمل جديد (Lead)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم العميل المحتمل" placeholder="مثال: د. عبد الله المالكي" value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
        <Input label="اسم الشركة / الجهة" placeholder="مستشفى الحياة" value={company} onChange={(e) => setCompany(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="البريد الإلكتروني" type="email" placeholder="lead@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="رقم الجوال" placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select
            label="مصدر الاستقطاب"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={[
              { label: "Google Ads", value: "Google Ads" },
              { label: "معرض الصحة 2026", value: "معرض الصحة 2026" },
              { label: "Referral", value: "Referral" },
            ]}
          />
          <Select
            label="المرحلة الأوّلية"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            options={[
              { label: "عميل محتمل جديد", value: "عميل محتمل جديد" },
              { label: "تم التواصل والتأهيل", value: "تم التواصل والتأهيل" },
            ]}
          />
          <Input label="مسؤول المبيعات" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ العميل المحتمل</Button>
        </div>
      </form>
    </Modal>
  );
}
