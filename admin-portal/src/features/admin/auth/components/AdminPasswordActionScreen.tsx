"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useI18n } from "@/i18n/I18nContext";
import { Field, Input, Button } from "@/design-system";
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
} from "../lib/admin-password-policy";
import {
  useAdminPasswordAction,
  type AdminPasswordActionMode,
} from "../hooks/useAdminPasswordAction";

export function AdminPasswordActionScreen({
  mode,
}: {
  mode: AdminPasswordActionMode;
}) {
  const { t } = useI18n();
  const action = useAdminPasswordAction(mode);
  const copy = mode === "acceptInvite"
    ? t.authActions.acceptInvite
    : t.authActions.resetPassword;
  const common = t.authActions.common;

  if (!action.isTokenReady) {
    return (
      <AuthShell>
        <div role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{common.checkingLink}</span>
        </div>
      </AuthShell>
    );
  }

  if (action.token === null) {
    return (
      <AuthShell>
        <div className="space-y-3 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-lg bg-destructive-subtle text-destructive-subtle-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {common.missingTokenTitle}
            </h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {common.missingTokenDescription}
            </p>
          </div>
          <Button asChild variant="primary" size="sm">
            <Link href="/login">{common.backToSignIn}</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const rules = [
    ["length", common.rules.length],
    ["lowercase", common.rules.lowercase],
    ["uppercase", common.rules.uppercase],
    ["number", common.rules.number],
    ["symbol", common.rules.symbol],
  ] as const;
  const errorMessage = action.error ? common.errors[action.error] : null;

  return (
    <AuthShell>
      <div className="space-y-3.5">
        <div className="text-center">
          <div className="mx-auto mb-2 grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary rtl:normal-case rtl:tracking-normal">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-base sm:text-lg font-semibold tracking-tight text-foreground">
            {copy.title}
          </h1>
        </div>

        <form method="post" onSubmit={action.submit} className="space-y-3" noValidate>
          <PasswordField
            label={common.newPassword}
            value={action.password}
            onChange={action.setPassword}
            visible={action.showPassword}
            toggle={action.toggleShowPassword}
            showLabel={common.showPassword}
            hideLabel={common.hidePassword}
            autoComplete="new-password"
          />

          <div
            role="group"
            className="grid gap-1.5 rounded-md border border-border bg-muted p-2.5"
            aria-label={common.passwordRequirements}
          >
            {rules.map(([key, label]) => {
              const passed = action.passwordChecks[key];
              const stateLabel = passed
                ? common.requirementMet
                : common.requirementNotMet;
              return (
                <div key={key} className={`flex items-center gap-1.5 text-xs ${passed ? "text-success" : "text-muted-foreground"}`}>
                  {passed ? <CheckCircle2 className="size-3 text-success" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
                  <span>{label}</span>
                  <span className="ms-auto font-medium text-[11px]">{stateLabel}</span>
                </div>
              );
            })}
          </div>

          <PasswordField
            label={common.confirmPassword}
            value={action.confirmation}
            onChange={action.setConfirmation}
            visible={action.showPassword}
            toggle={action.toggleShowPassword}
            showLabel={common.showPassword}
            hideLabel={common.hidePassword}
            autoComplete="new-password"
          />

          {errorMessage ? (
            <p role="alert" tabIndex={-1} className="rounded-md border border-destructive/30 bg-destructive-subtle px-2.5 py-1.5 text-xs font-semibold text-destructive-subtle-foreground">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="sm" disabled={action.isSubmitting} className="w-full justify-center">
            {action.isSubmitting ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <KeyRound className="size-3.5" aria-hidden="true" />}
            <span>{action.isSubmitting ? copy.submitting : copy.submit}</span>
          </Button>
        </form>

        <div className="text-center">
          <Link href="/login" className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {common.backToSignIn}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  toggle,
  showLabel,
  hideLabel,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  toggle: () => void;
  showLabel: string;
  hideLabel: string;
  autoComplete: "new-password";
}) {
  return (
    <Field label={label} hideLabel required>
      {(fp) => (
        <div className="relative">
          <KeyRound className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            {...fp}
            size="sm"
            type={visible ? "text" : "password"}
            value={value}
            placeholder={`${label} *`}
            onChange={(event) => onChange(event.target.value)}
            minLength={ADMIN_PASSWORD_MIN_LENGTH}
            maxLength={ADMIN_PASSWORD_MAX_LENGTH}
            autoComplete={autoComplete}
            required
            className="ps-9 pe-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={toggle}
            aria-label={visible ? hideLabel : showLabel}
            aria-pressed={visible}
            className="absolute end-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
          </Button>
        </div>
      )}
    </Field>
  );
}
