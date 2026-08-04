"use client";

import { Loader2, Save } from "lucide-react";
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

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={editor.enabled} onChange={(event) => editor.setEnabled(event.target.checked)} disabled={!canUpdate || editor.pending} />
          Automatic rotation
        </label>
        <label className="text-[11px] text-slate-500">Interval hours<input type="number" min={24} max={8760} value={editor.intervalHours} onChange={(event) => editor.setIntervalHours(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <label className="text-[11px] text-slate-500">Window start UTC<input type="number" min={0} max={23} value={editor.windowStart} onChange={(event) => editor.setWindowStart(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <label className="text-[11px] text-slate-500">Window hours<input type="number" min={1} max={24} value={editor.windowHours} onChange={(event) => editor.setWindowHours(Number(event.target.value))} disabled={!canUpdate || editor.pending} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
      </div>
      {canUpdate && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={editor.reason} onChange={(event) => editor.setReason(event.target.value)} placeholder="Reason for policy change" maxLength={500} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={() => void editor.submit()} disabled={editor.pending || editor.reason.trim().length < 8} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{editor.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save policy</button>
        </div>
      )}
      {editor.error && <p className="mt-2 text-xs text-rose-600">{editor.error}</p>}
    </div>
  );
}
