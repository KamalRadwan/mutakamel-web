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
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useI18n } from "@/i18n/I18nContext";
import { Card, Field, Input, Button } from "@/design-system";
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
      <PublicAuthShell>
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span>{common.checkingLink}</span>
        </div>
      </PublicAuthShell>
    );
  }

  if (action.token === null) {
    return (
      <PublicAuthShell>
        <div className="space-y-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-950/40 dark:text-danger-300">
            <KeyRound className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {common.missingTokenTitle}
            </h1>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {common.missingTokenDescription}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-xs font-semibold text-white hover:bg-brand-500"
          >
            {common.backToSignIn}
          </Link>
        </div>
      </PublicAuthShell>
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
    <PublicAuthShell>
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand-500 text-ink-950">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <p className="text-2xs font-semibold uppercase tracking-[0.22em] text-brand-700 dark:text-brand-400">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {copy.title}
          </h1>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>

        <form onSubmit={action.submit} className="space-y-4" noValidate>
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

          <div className="grid gap-2 rounded-xl border border-border bg-muted p-3" aria-label={common.passwordRequirements}>
            {rules.map(([key, label]) => {
              const passed = action.passwordChecks[key];
              return (
                <div key={key} className={`flex items-center gap-2 text-2xs ${passed ? "text-brand-700 dark:text-brand-400" : "text-muted-foreground"}`}>
                  {passed ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
                  <span>{label}</span>
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
            <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-xs font-semibold text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-300">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={action.isSubmitting} className="w-full justify-center">
            {action.isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
            <span>{action.isSubmitting ? copy.submitting : copy.submit}</span>
          </Button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
            {common.backToSignIn}
          </Link>
        </div>
      </div>
    </PublicAuthShell>
  );
}

function PublicAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas p-4 text-foreground sm:p-6">
      <div className="absolute end-4 top-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="relative z-10 w-full max-w-md p-6 shadow-2xl sm:p-8">
        {children}
      </Card>
    </main>
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
    <Field label={label}>
      {(fp) => (
        <div className="relative">
          <KeyRound className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            {...fp}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            minLength={ADMIN_PASSWORD_MIN_LENGTH}
            maxLength={ADMIN_PASSWORD_MAX_LENGTH}
            autoComplete={autoComplete}
            required
            className="ps-10 pe-10"
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={visible ? hideLabel : showLabel}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
}
