"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AvailabilityHistoryEntry } from "../hooks/useInventoryAvailability";
import type { useInventoryReferences } from "../hooks/useInventoryReferences";
import { AvailabilitySnapshot } from "./AvailabilitySnapshot";

export function AvailabilityInspector({ entry, references, onClose, onRestoreFocus }: {
  entry: AvailabilityHistoryEntry | null; references: ReturnType<typeof useInventoryReferences>; onClose: () => void; onRestoreFocus: () => void;
}) {
  const { t } = useI18n();
  return <Dialog open={Boolean(entry)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="2xl" className="max-h-[90dvh] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <DialogTitle>{t.tradeInventory.viewSnapshot}</DialogTitle>
      <DialogDescription>{t.tradeInventory.availabilityAdvisory}</DialogDescription>
      {entry ? <AvailabilitySnapshot snapshot={entry.snapshot} query={entry.query} references={references} /> : null}
      <div className="flex justify-end"><Button variant="outline" onClick={onClose}>{t.common.close}</Button></div>
    </DialogContent>
  </Dialog>;
}
