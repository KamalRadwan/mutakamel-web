"use client";

import { Button, ConfirmActionModal, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../acquisition-source-contract";

interface DeleteModalProps {
  isOpen: boolean;
  item: AcquisitionSource | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string | null;
  blocked: boolean;
  onEdit: () => void;
}

export function DeleteAcquisitionSourcesConfirmModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isSubmitting,
  error,
  blocked,
  onEdit,
}: DeleteModalProps) {
  const { t, lang } = useI18n();
  const name = localizedName(item, lang);
  const message = t.crmAcquisitionSources.deleteMessage(name);

  if (blocked) return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.crmAcquisitionSources.deleteInUseTitle}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t.crmAcquisitionSources.deleteInUse}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.close}</Button>
          <Button variant="outline" onClick={onEdit}>{t.crmAcquisitionSources.editAction}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <ConfirmActionModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmAcquisitionSources.deleteTitle}
      description={error ? `${message} ${error}` : message}
      confirmLabel={isSubmitting ? t.crmAcquisitionSources.deleting : t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={onConfirm}
      loading={isSubmitting}
    />
  );
}
