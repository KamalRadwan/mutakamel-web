"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { fqdn: string; subdomain: string; sslStatus: "valid" | "renewing" | "expired"; healthCheck: "healthy" | "degraded" | "down"; ipAddress: string }) => void;
}

export function CreateHostStatusModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [fqdn, setFqdn] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [ipAddress, setIpAddress] = useState("167.99.12.34");
  const [sslStatus, setSslStatus] = useState<"valid" | "renewing" | "expired">("valid");
  const [healthCheck, setHealthCheck] = useState<"healthy" | "degraded" | "down">("healthy");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fqdn) return;
    onSubmit({ fqdn, subdomain: subdomain || fqdn.split(".")[0], sslStatus, healthCheck, ipAddress });
    setFqdn("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة النطاق والحالة العامة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="النطاق الكامل (FQDN)" placeholder="custom-tenant.com" value={fqdn} onChange={(e) => setFqdn(e.target.value)} required />
        <Input label="النطاق الفرعي (Subdomain)" placeholder="custom-tenant" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
        <Input label="عنوان السيرفر IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="حالة شهادة الأمان SSL"
            value={sslStatus}
            onChange={(e) => setSslStatus(e.target.value as "valid" | "renewing" | "expired")}
            options={[
              { label: "سارية (Valid)", value: "valid" },
              { label: "جاري التجديد (Renewing)", value: "renewing" },
              { label: "منتهية (Expired)", value: "expired" },
            ]}
          />
          <Select
            label="فحص السلامة HealthCheck"
            value={healthCheck}
            onChange={(e) => setHealthCheck(e.target.value as "healthy" | "degraded" | "down")}
            options={[
              { label: "سليم (Healthy)", value: "healthy" },
              { label: "بطيء (Degraded)", value: "degraded" },
              { label: "متوقف (Down)", value: "down" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ النطاق</Button>
        </div>
      </form>
    </Modal>
  );
}
