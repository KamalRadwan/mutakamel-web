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
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="size-5 animate-spin" />
          <span>{common.checkingLink}</span>
        </div>
      </PublicAuthShell>
    );
  }

  if (action.token === null) {
    return (
      <PublicAuthShell>
        <div className="space-y-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <KeyRound className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {common.missingTokenTitle}
            </h1>
            <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
              {common.missingTokenDescription}
            </p>
          </div>
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700">
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
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-2xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {copy.title}
          </h1>
          <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>
        </div>

        <form onSubmit={action.submit} className="space-y-4" noValidate>
          <PasswordField
            id="new-password"
            label={common.newPassword}
            value={action.password}
            onChange={action.setPassword}
            visible={action.showPassword}
            toggle={action.toggleShowPassword}
            showLabel={common.showPassword}
            hideLabel={common.hidePassword}
            autoComplete="new-password"
          />

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50" aria-label={common.passwordRequirements}>
            {rules.map(([key, label]) => {
              const passed = action.passwordChecks[key];
              return (
                <div key={key} className={`flex items-center gap-2 text-[11px] ${passed ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}>
                  {passed ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          <PasswordField
            id="confirm-password"
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
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={action.isSubmitting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            <span>{action.isSubmitting ? copy.submitting : copy.submit}</span>
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {common.backToSignIn}
          </Link>
        </div>
      </div>
    </PublicAuthShell>
  );
}

function PublicAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900 dark:bg-canvas dark:text-slate-100 sm:p-6">
      <div className="pointer-events-none absolute -start-40 -top-40 size-96 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/10" />
      <div className="pointer-events-none absolute -bottom-40 -end-40 size-96 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-600/10" />
      <div className="absolute end-4 top-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <section className="relative z-10 w-full max-w-md rounded-xl border border-slate-200/80 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-8">
        {children}
      </section>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  toggle,
  showLabel,
  hideLabel,
  autoComplete,
}: {
  id: string;
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-start text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <KeyRound className="absolute start-3.5 top-3.5 size-4 text-slate-400" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={ADMIN_PASSWORD_MIN_LENGTH}
          maxLength={ADMIN_PASSWORD_MAX_LENGTH}
          autoComplete={autoComplete}
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 ps-10 pe-10 text-xs text-slate-900 outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute end-3 top-3 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
