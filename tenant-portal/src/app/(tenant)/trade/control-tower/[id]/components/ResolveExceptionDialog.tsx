"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { RESOLUTION_CODES, type buildResolveExceptionRequest } from "../../control-tower-contract";
import { useExceptionResolution } from "../hooks/useExceptionResolution";

interface ResolveExceptionDialogProps {
  onClose: () => void;
  onConfirm: (request: ReturnType<typeof buildResolveExceptionRequest>) => void;
  loading: boolean;
  error?: string;
}

export function ResolveExceptionDialog({ onClose, onConfirm, loading, error }: ResolveExceptionDialogProps) {
  const { t, dir } = useI18n();
  const form = useExceptionResolution(onConfirm, loading);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent
        dir={dir}
        showCloseButton={!loading}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => { if (loading) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (loading) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{t.tradeControlTower.resolve}</DialogTitle>
          <DialogDescription>{t.tradeControlTower.resolveDescription}</DialogDescription>
        </DialogHeader>
        <Field label={t.tradeControlTower.resolutionCode} required showLabel>
          <Select
            value={form.resolutionCode}
            onValueChange={form.setResolutionCode}
            disabled={loading}
            dir={dir}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.tradeControlTower.resolutionCodePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTION_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t.tradeControlTower.resolutionCodes[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.tradeGovernance.reason} hint={t.tradeControlTower.reasonHint} required showLabel>
          <Textarea
            value={form.reason}
            onChange={(event) => form.setReason(event.target.value)}
            maxLength={240}
            disabled={loading}
          />
        </Field>
        <Field label={t.tradeControlTower.evidence} hint={t.tradeControlTower.evidenceHint} showLabel>
          <Textarea
            value={form.evidence}
            onChange={(event) => form.setEvidence(event.target.value)}
            rows={4}
            disabled={loading}
            dir="ltr"
          />
        </Field>
        {form.error || error ? <p role="alert" className="text-xs text-destructive">{form.error ?? error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={form.confirm} disabled={!form.canConfirm} loading={loading}>
            {t.tradeCommon.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
