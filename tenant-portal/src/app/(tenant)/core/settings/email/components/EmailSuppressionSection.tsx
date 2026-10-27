"use client";

import { Button, Field, Input, ConfirmActionModal, PermissionGate, useCan } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useEmailSuppression } from "../hooks/useEmailSuppression";

export function EmailSuppressionSection() {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const allowed = useCan("workspace.email.manage", { tenantWide: true });
  if (!user || !allowed) return null;
  return <EmailSuppressionForm key={realtimeAuthGeneration ?? user.id} />;
}

function EmailSuppressionForm() {
  const form = useEmailSuppression();
  const { copy, result } = form;
  return (
    <PermissionGate require="workspace.email.manage" denied={form.denied}>
      <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="email-suppression-title">
        <h2 id="email-suppression-title" className="text-sm font-semibold">{copy.title}</h2>
        <p className="text-xs text-muted-foreground">{copy.description}</p>

        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void form.lookup(); }}>
          <Field label={copy.address} showLabel hint={copy.privacy} error={form.error} required>
            <Input type="email" dir="ltr" autoComplete="off" spellCheck={false} maxLength={320}
              value={form.address} onChange={(event) => form.updateAddress(event.target.value)}
              disabled={form.pending || form.denied} required />
          </Field>
          <Button type="submit" variant="outline" disabled={form.pending || form.denied || !form.address.trim()}>
            {form.pending ? copy.working : copy.lookup}
          </Button>
        </form>
        <div role="status" aria-live="polite" aria-busy={form.pending}>
          {form.notice ? <p className="text-sm">{form.notice}</p> : null}
          {result ? (
            <div className="space-y-2">
              <p className="text-sm">{result.suppressed ? copy.suppressed : copy.notSuppressed}</p>
              {result.suppressed ? (
                <>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">{copy.reason}</dt><dd>{copy.reasons[result.reasonCode]}</dd></div>
                    <div><dt className="text-muted-foreground">{copy.firstOccurred}</dt><dd>{form.date(result.firstOccurredAt)}</dd></div>
                    <div><dt className="text-muted-foreground">{copy.lastOccurred}</dt><dd>{form.date(result.lastOccurredAt)}</dd></div>
                  </dl>
                  <Button type="button" variant="outline" disabled={form.pending || form.denied} onClick={() => form.setConfirming(true)}>
                    {copy.lift}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <ConfirmActionModal
        open={form.confirming} onOpenChange={form.setConfirming}
        title={copy.confirmTitle} description={copy.confirmDescription}
        confirmLabel={copy.lift} cancelLabel={copy.cancel}
        loading={form.pending}
        onConfirm={() => void form.lift()}
      />
    </PermissionGate>
  );
}

