"use client";

import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from "@/design-system";
import { useLogin } from "./hooks/useLogin";

export default function LoginPage() {
  const {
    t,
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    showPassword,
    isSubmitting,
    error,
    fieldErrors,
    forgotFieldError,
    forgotError,
    emailInputRef,
    passwordInputRef,
    errorSummaryRef,
    submissionErrorRef,
    forgotEmailInputRef,
    forgotErrorRef,
    isForgotModalOpen,
    setIsForgotModalOpen,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  } = useLogin();

  const invalidFieldCount = Number(Boolean(fieldErrors.email)) + Number(Boolean(fieldErrors.password));
  const showValidationSummary = invalidFieldCount > 1;
  const passwordToggleLabel = showPassword
    ? t.authActions.common.hidePassword
    : t.authActions.common.showPassword;

  return (
    <AuthShell
      footer={<p>{t.login.footerNote} · {t.common.portalName}</p>}
      cardClassName="space-y-6"
    >
      <div className="space-y-2 text-center">
        <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {t.login.title}
        </h1>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.login.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {showValidationSummary ? (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="font-semibold">{t.login.validationSummaryTitle}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {fieldErrors.email ? (
                <li><a className="underline underline-offset-2" href="#login-email">{fieldErrors.email}</a></li>
              ) : null}
              {fieldErrors.password ? (
                <li><a className="underline underline-offset-2" href="#login-password">{fieldErrors.password}</a></li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {error ? (
          <div
            ref={submissionErrorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {error}
          </div>
        ) : null}

        <Field id="login-email" label={t.login.emailLabel} error={fieldErrors.email} required>
          {(fieldProps) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                {...fieldProps}
                ref={emailInputRef}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="ps-10"
              />
            </div>
          )}
        </Field>

        <Field
          id="login-password"
          label={t.login.passwordLabel}
          error={fieldErrors.password}
          required
          labelAction={(
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => setIsForgotModalOpen(true)}
              className="h-auto min-h-0 px-0 text-xs"
            >
              {t.login.forgotPassword}
            </Button>
          )}
        >
          {(fieldProps) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                {...fieldProps}
                ref={passwordInputRef}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="ps-10 pe-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={toggleShowPassword}
                aria-label={passwordToggleLabel}
                aria-pressed={showPassword}
                title={passwordToggleLabel}
                className="absolute end-1 top-1/2 size-7 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              >
                {showPassword
                  ? <EyeOff className="size-4" aria-hidden="true" />
                  : <Eye className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          )}
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="remember-session"
            checked={rememberMe}
            onCheckedChange={toggleRememberMe}
          />
          <label htmlFor="remember-session" className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
            {t.login.rememberMe}
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          className="mt-2 w-full justify-center"
        >
          {isSubmitting ? t.login.submitting : t.login.submitButton}
        </Button>
      </form>

      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info-subtle p-2.5 text-info-subtle-foreground">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm">{t.login.forgotPassword}</DialogTitle>
                <DialogDescription className="text-xs">{t.login.forgotModalDescription}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-3" noValidate>
            {forgotError ? (
              <div
                ref={forgotErrorRef}
                role="alert"
                tabIndex={-1}
                className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {forgotError}
              </div>
            ) : null}
            <Field id="forgot-email" label={t.login.emailLabel} error={forgotFieldError ?? undefined} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  ref={forgotEmailInputRef}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsForgotModalOpen(false)}>
                {t.login.cancel}
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
                {t.login.sendResetLink}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
