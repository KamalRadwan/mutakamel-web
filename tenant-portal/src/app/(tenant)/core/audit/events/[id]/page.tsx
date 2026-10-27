"use client";
import { use } from "react";
import Link from "next/link";
import { Button, PageHeader } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { AuditEventDetail } from "@/components/audit/AuditEventDetail";

export default function AuditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  return <div className="flex flex-col gap-4">
    <PageHeader title={t.audit.ledger.detail} leading={<Button variant="ghost" size="sm" asChild><Link href="/core/audit">{t.common.back}</Link></Button>} />
    <AuditEventDetail id={id} />
  </div>;
}
