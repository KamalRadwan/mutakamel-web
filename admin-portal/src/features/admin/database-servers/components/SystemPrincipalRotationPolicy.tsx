"use client";

import { Loader2, Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type {
  DatabaseServerProvisioningPrincipalBindingView,
  UpdateDatabaseServerSystemPrincipalRotationDto,
} from "../types";
import { useSystemPrincipalRotationEditor } from "../hooks/useSystemPrincipalRotationEditor";

interface Props {
  binding: DatabaseServerProvisioningPrincipalBindingView;
  canUpdate: boolean;
  onSave: (dto: UpdateDatabaseServerSystemPrincipalRotationDto) => Promise<unknown>;
}

export function SystemPrincipalRotationPolicy({ binding, canUpdate, onSave }: Props) {
  const editor = useSystemPrincipalRotationEditor(binding, onSave);
  const { t } = useI18n();
  const copy = t.databaseServerDetail.readiness.rotationPolicy;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <input type="checkbox" checked={editor.enabled} onChange={(event) => editor.setEnabled(event.target.checked)} disabled={!canUpdate || editor.pending} className="accent-brand-600" />
          {copy.automaticRotation}
        </label>
        <label className="text-xs text-muted-foreground">
          {copy.intervalHours}
          <input type="number" min={24} max={8760} value={editor.intervalHours} onChange={(event) => editor.setIntervalHours(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">
          {copy.windowStartUtc}
          <input type="number" min={0} max={23} value={editor.windowStart} onChange={(event) => editor.setWindowStart(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">
          {copy.windowHours}
          <input type="number" min={1} max={24} value={editor.windowHours} onChange={(event) => editor.setWindowHours(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground" />
        </label>
      </div>
      {canUpdate && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={editor.reason} onChange={(event) => editor.setReason(event.target.value)} placeholder={copy.reasonPlaceholder} maxLength={500} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground" />
          <button type="button" onClick={() => void editor.submit()} disabled={editor.pending || editor.reason.trim().length < 8} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-ink-950 disabled:opacity-50 dark:bg-brand-400">{editor.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{copy.savePolicy}</button>
        </div>
      )}
      {editor.error && <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">{editor.error}</p>}
    </div>
  );
}
