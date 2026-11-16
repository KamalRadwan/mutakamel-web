"use client";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Checkbox, DegradedBanner, Field, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { ServerListKey } from "../asterisk-contract";
import type { CrmSettingsView } from "../hooks/useCrmSettingsView";

export function TelephonyServerList({ model, name }: { model: CrmSettingsView; name: ServerListKey }) {
  const { t, lang } = useI18n();
  const s = t.crmSettings;
  const a = model.draft?.asteriskIntegration;
  if (!a) return null;
  const replacing = Boolean(name === "turnServers" ? a.replaceTurnServers : a.replaceIceServers);
  const readOnly = !model.canManage || !replacing;
  const disabled = model.isSaving || model.isLoading;
  const rows = a[name] ?? [];
  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">{s.telephonyFields[name]}</h3>
      {model.canManage && <label className="flex items-center gap-2 text-sm"><Checkbox checked={replacing} disabled={disabled} onCheckedChange={(value) => model.replaceList(name, value === true)} />{s.replaceList}</label>}
      {replacing && <DegradedBanner message={s.replacementHelp} />}
      <p className="text-xs text-muted-foreground">{s.serverHelp}</p>
      {!rows.length && <p className="text-sm text-muted-foreground">{s.noServers}</p>}
      {rows.map((row, index) => (
        <div key={`${name}-${index}`} className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{s.serverNumber.replace("{number}", formatNumber(index + 1, lang))}</span>
            {!readOnly && <Button variant="ghost" size="xs" disabled={disabled} onClick={() => model.removeServer(name, index)} aria-label={s.removeServer}><Trash2 className="size-4" aria-hidden="true" />{s.removeServer}</Button>}
          </div>
          <Field label={s.serverUrls} showLabel readOnly={readOnly} required error={model.errors[`${name}.${index}.urls`]}>
            <Textarea dir="ltr" rows={2} readOnly={readOnly} disabled={disabled} value={row.urls.join("\n")} onChange={(event) => model.updateServer(name, index, { urls: event.target.value.split(/\r?\n/) })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.username} showLabel readOnly={readOnly} hint={s.maxCharacters.replace("{max}", "128")} error={model.errors[`${name}.${index}.username`]}><Input dir="ltr" readOnly={readOnly} disabled={disabled} maxLength={128} value={row.username ?? ""} onChange={(event) => model.updateServer(name, index, { username: event.target.value })} /></Field>
            {!readOnly && <Field label={s.newCredential} showLabel hint={s.writeOnly} error={model.errors[`${name}.${index}.credential`]}><Input type="password" dir="ltr" autoComplete="new-password" maxLength={256} disabled={disabled} value={row.credential ?? ""} onChange={(event) => model.updateServer(name, index, { credential: event.target.value, clearCredential: false })} /></Field>}
          </div>
          {row.hasCredential && <div className="flex flex-wrap items-center gap-3"><Badge tone="neutral">{s.credentialStored}</Badge>
            {!readOnly && <label className="flex items-center gap-2 text-xs"><Checkbox checked={Boolean(row.clearCredential)} disabled={disabled} onCheckedChange={(value) => model.updateServer(name, index, { clearCredential: value === true, credential: "" })} />{s.clearCredential}</label>}
          </div>}
        </div>
      ))}
      {!readOnly && <Button variant="outline" size="sm" disabled={disabled || rows.length >= 16} onClick={() => model.addServer(name)}><Plus className="size-4" aria-hidden="true" />{s.addServer}</Button>}
    </section>
  );
}
