"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { useMfaChallenge } from "@/lib/auth/useMfaChallenge";
import { INTL_LOCALE } from "@/lib/format/locale";
import { Button } from "../../primitives/Button";
import { Field } from "../../primitives/Field";
import { Input } from "../../primitives/Input";

export function MfaCodeStep({ flow, onRestart }: {
  flow: ReturnType<typeof useMfaChallenge>;
  onRestart: () => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.mfa;
  const number = new Intl.NumberFormat(INTL_LOCALE[lang]);
  return (
    <form method="post" onSubmit={flow.submit} className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{copy.codeTitle}</h2>
      <p className="text-xs text-muted-foreground">{copy.codeHint}</p>
      {flow.blocked ? <p role="status" className="text-xs text-muted-foreground">
        {copy.retryWait.replace("{seconds}", number.format(flow.retrySeconds))}
      </p> : null}
      <Field showLabel label={copy.codeLabel} required
        error={flow.error ? copy.errors[flow.error] : undefined}>
        <Input name="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code"
          dir="ltr" pattern="[0-9]{6}" maxLength={6} required autoFocus
          value={flow.code} onChange={(event) => flow.setCode(event.target.value)}
          disabled={flow.busy || flow.expired || flow.restartRequired} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" size="sm" loading={flow.busy}
          disabled={flow.expired || flow.restartRequired || flow.blocked}>{copy.verify}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void flow.resend()}
          disabled={flow.busy || flow.expired || flow.restartRequired || flow.resendSeconds > 0}>
          {flow.resendSeconds > 0
            ? copy.resendWait.replace("{seconds}", number.format(flow.resendSeconds)) : copy.resend}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={flow.busy} onClick={onRestart}>
          {copy.restart}
        </Button>
      </div>
    </form>
  );
}
