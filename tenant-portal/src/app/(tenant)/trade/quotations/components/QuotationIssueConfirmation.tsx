"use client";

import { Send } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function QuotationIssueConfirmation({ open, onOpenChange, onConfirm, loading }: {
  open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; loading: boolean;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  return <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}><DialogContent size="lg" aria-busy={loading || undefined}><DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="size-4 text-primary" aria-hidden="true" />{copy.issueConfirmTitle}</DialogTitle><DialogDescription>{copy.issueConfirmDescription}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>{t.common.cancel}</Button><Button variant="primary" loading={loading} onClick={onConfirm}>{copy.issueConfirm}</Button></DialogFooter></DialogContent></Dialog>;
}
