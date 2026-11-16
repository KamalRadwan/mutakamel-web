"use client";
import { Button, DegradedBanner, Field, Input, Sheet, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle, Switch, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ASTERISK_TEXT_LIMITS, type AsteriskTextKey } from "../asterisk-contract";
import type { CrmSettingsView } from "../hooks/useCrmSettingsView";
import { TelephonyServerList } from "./TelephonyServerList";

export function TelephonyDrawer({ model }: { model: CrmSettingsView }) {
  const { t } = useI18n();
  const s = t.crmSettings;
  const a = model.draft?.asteriskIntegration;
  const readOnly = !model.canManage;
  const disabled = model.isSaving || model.isLoading;
  return (
    <Sheet open={model.telephonyOpen} onOpenChange={model.closeTelephony}>
      <SheetContent side="end" className="w-full sm:max-w-3xl" showCloseButton={!model.isSaving} onEscapeKeyDown={(event) => { if (model.isSaving) event.preventDefault(); }} onInteractOutside={(event) => { if (model.isSaving) event.preventDefault(); }}>
        <SheetHeader><SheetTitle>{s.telephonyTitle}</SheetTitle><SheetDescription>{s.telephonyDescription}</SheetDescription></SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto pe-1 pb-3">
          <p className="text-xs text-muted-foreground">{readOnly ? s.readOnly : s.telephonyDraft}</p>
          {a && <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{s.connection}</h2>
              <label className="flex items-center justify-between gap-3 text-sm"><span>{s.telephonyFields.enabled}</span><Switch checked={a.enabled} disabled={disabled || readOnly} onCheckedChange={(value) => model.setAsterisk("enabled", value)} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(ASTERISK_TEXT_LIMITS) as AsteriskTextKey[]).map((key) => <Field key={key} label={s.telephonyFields[key]} showLabel readOnly={readOnly} error={model.errors[key]}
                  hint={key === "websocketUrl" ? s.websocketHelp : s.maxCharacters.replace("{max}", String(ASTERISK_TEXT_LIMITS[key]))}>
                  <Input dir="ltr" readOnly={readOnly} disabled={disabled} maxLength={ASTERISK_TEXT_LIMITS[key]} value={a[key] ?? ""} onChange={(event) => model.setAsterisk(key, event.target.value || null)} />
                </Field>)}
              </div>
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <h2 className="text-sm font-semibold">{s.diagnostics}</h2>
              <Field label={s.telephonyFields.registerExpires} showLabel readOnly={readOnly} hint={s.registrationHelp} error={model.errors.registerExpires}>
                <Input type="number" min={60} max={86400} step={1} readOnly={readOnly} disabled={disabled}
                  value={a.registerExpires == null || Number.isNaN(a.registerExpires) ? "" : a.registerExpires}
                  onChange={(event) => model.setAsterisk("registerExpires", event.target.value === "" ? null : event.target.valueAsNumber)} />
              </Field>
              {(["sessionTimers", "traceSip", "allowInvalidTlsCertificate"] as const).map((key) => <label key={key} className="flex items-center justify-between gap-3 text-sm"><span>{s.telephonyFields[key]}</span><Switch checked={Boolean(a[key])} disabled={disabled || readOnly} onCheckedChange={(value) => model.setAsterisk(key, value)} /></label>)}
              {a.allowInvalidTlsCertificate && <DegradedBanner message={s.existingTlsWarning} />}
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <h2 className="text-sm font-semibold">{s.serverLists}</h2>
              <Field label={s.telephonyFields.stunServers} showLabel readOnly={readOnly} hint={s.stunHelp} error={model.errors.stunServers}>
                <Textarea dir="ltr" rows={3} readOnly={readOnly} disabled={disabled} value={(a.stunServers ?? []).join("\n")}
                  onChange={(event) => model.setAsterisk("stunServers", event.target.value === "" ? [] : event.target.value.split(/\r?\n/))} />
              </Field>
              <TelephonyServerList name="turnServers" model={model} /><TelephonyServerList name="iceServers" model={model} />
            </section>
          </>}
          <p className="text-xs text-muted-foreground">{s.configurationOnly}</p>
        </div>
        <SheetFooter className="border-t border-border pt-3"><Button variant="outline" disabled={model.isSaving} onClick={() => model.closeTelephony(false)}>{s.reviewSettings}</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
