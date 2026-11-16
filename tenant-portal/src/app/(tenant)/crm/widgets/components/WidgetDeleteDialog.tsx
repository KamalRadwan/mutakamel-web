"use client";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
export function WidgetDeleteDialog({ open, title, description, confirmLabel, pending, blocked, error, onClose, onConfirm }: { open: boolean; title: string; description: string; confirmLabel?: string; pending: boolean; blocked: boolean; error?: string; onClose: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  return <AlertDialog open={open} onOpenChange={(next) => { if (!next && !pending) onClose(); }}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
    {error && <p role="alert" className="rounded-md border border-negative-200 bg-negative-50 p-3 text-sm text-negative-800">{error}</p>}
    <AlertDialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>{t.common.cancel}</Button>
      <Button variant="destructive" loading={pending} disabled={pending || blocked} onClick={onConfirm}>{confirmLabel ?? t.common.delete}</Button></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
