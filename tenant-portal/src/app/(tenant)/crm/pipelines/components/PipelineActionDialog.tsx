"use client";

import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, Button,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface PipelineActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  blocked?: boolean;
  onConfirm: () => void;
  onReload?: () => void;
}

export function PipelineActionDialog(props: PipelineActionDialogProps) {
  const { t } = useI18n();
  return (
    <AlertDialog open={props.open} onOpenChange={(open) => { if (!props.pending) props.onOpenChange(open); }}>
      <AlertDialogContent aria-busy={props.pending || undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {props.error && <p role="alert" className="rounded-md border border-negative-200 bg-negative-50 p-3 text-sm text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-200">{props.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.pending}>{props.blocked ? t.common.close : t.common.cancel}</AlertDialogCancel>
          {props.blocked ? props.onReload && <Button variant="outline" onClick={props.onReload}>{t.common.retry}</Button> : (
            <Button variant="destructive" loading={props.pending} disabled={props.pending} onClick={props.onConfirm}>{props.confirmLabel}</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
