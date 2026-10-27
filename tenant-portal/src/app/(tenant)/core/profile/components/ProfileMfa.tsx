"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Button, Field, Input, MfaCodeStep } from "@/design-system";
import { useProfileMfa } from "../hooks/useProfileMfa";

export function ProfileMfa() {
  const { t } = useI18n();
  const copy = t.mfa;
  const screen = useProfileMfa();
  const number = new Intl.NumberFormat(copy.numberLocale);
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4" aria-label={copy.title}>
      <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
      <p className="text-xs text-muted-foreground">{copy.description}</p>
      {screen.loading ? <p role="status" className="text-xs text-muted-foreground">{copy.loading}</p>
        : screen.loadFailed ? <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">{copy.errors.unavailable}</p>
          <Button variant="outline" size="sm" onClick={() => void screen.reload()}>{copy.reload}</Button>
        </div> : screen.mfa.step ? <MfaCodeStep flow={screen.mfa} onRestart={screen.restart} />
        : <div className="space-y-3">
          <p className="text-xs text-foreground">{screen.enabled ? copy.enabled : copy.disabled}</p>
          {screen.editing ? <form method="post" className="space-y-3" onSubmit={screen.submit}>
            {screen.mfa.error ? <p role="alert" className="text-xs text-destructive">{copy.errors[screen.mfa.error]}</p> : null}
            {screen.mfa.blocked ? <p role="status" className="text-xs text-muted-foreground">
              {copy.retryWait.replace("{seconds}", number.format(screen.mfa.retrySeconds))}
            </p> : null}
            <Field showLabel label={copy.currentPassword} required>
              <Input type="password" name="currentPassword" autoComplete="current-password"
                required maxLength={1024} value={screen.password}
                onChange={(event) => screen.setPassword(event.target.value)} disabled={screen.sending} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" size="sm" loading={screen.sending}
                disabled={screen.mfa.blocked}>{copy.sendCode}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={screen.restart}
                disabled={screen.sending}>{copy.cancel}</Button>
            </div>
          </form> : <Button variant="outline" size="sm" onClick={() => screen.setEditing(true)}>
            {screen.enabled ? copy.disable : copy.enable}
          </Button>}
        </div>}
      <p className="text-xs text-muted-foreground">{copy.recovery}</p>
    </section>
  );
}
