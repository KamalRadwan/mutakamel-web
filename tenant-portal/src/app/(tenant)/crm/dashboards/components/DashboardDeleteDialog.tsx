"use client";
import { DashboardRecoveryNotice, type DashboardRecoveryProps } from "./DashboardRecoveryNotice";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
export function DashboardDeleteDialog({ open, onOpenChange, title, description, pending, blocked, error, onConfirm, recovery }: {
  open: boolean; onOpenChange: (value: boolean) => void; title: string; description: string; pending: boolean; blocked: boolean; error?: string; recovery?: DashboardRecoveryProps; onConfirm: () => void;
}) {
  const { t } = useI18n();
  return <AlertDialog open={open} onOpenChange={(value) => { if (!pending) onOpenChange(value); }}><AlertDialogContent aria-busy={pending}>
    <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
    {recovery && <DashboardRecoveryNotice {...recovery} />}
    {error && <p role="alert" className="text-sm text-negative-700">{error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel><AlertDialogAction disabled={pending || blocked} onClick={(event) => { event.preventDefault(); onConfirm(); }}>{t.common.delete}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}

