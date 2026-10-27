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
  MfaCodeStep,
} from "@/design-system";
import { useLogin } from "./hooks/useLogin";

export default function LoginPage() {
  const {
    mfa,
    t,
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    showPassword,
    isSubmitting,
    isCoolingDown,
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
      cardClassName="space-y-4"
    >
      <div className="space-y-1.5 text-center">
        <div className="mb-1 inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
          {t.login.title}
        </h1>
      </div>

      {mfa.step ? <MfaCodeStep flow={mfa} onRestart={mfa.reset} /> : (
      <form method="post" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {showValidationSummary ? (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {error}
          </div>
        ) : null}

        <Field id="login-email" label={t.login.emailLabel} hideLabel error={fieldErrors.email} required>
          {(fieldProps) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                {...fieldProps}
                ref={emailInputRef}
                size="sm"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                placeholder={`${t.login.emailLabel} *`}
                onChange={(event) => setEmail(event.target.value)}
                className="ps-9"
              />
            </div>
          )}
        </Field>

        <Field
          id="login-password"
          label={t.login.passwordLabel}
          hideLabel
          error={fieldErrors.password}
          required
        >
          {(fieldProps) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                {...fieldProps}
                ref={passwordInputRef}
                size="sm"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                placeholder={`${t.login.passwordLabel} *`}
                onChange={(event) => setPassword(event.target.value)}
                className="ps-9 pe-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={toggleShowPassword}
                aria-label={passwordToggleLabel}
                aria-pressed={showPassword}
                title={passwordToggleLabel}
                className="absolute end-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              >
                {showPassword
                  ? <EyeOff className="size-3.5" aria-hidden="true" />
                  : <Eye className="size-3.5" aria-hidden="true" />}
              </Button>
            </div>
          )}
        </Field>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-session"
              checked={rememberMe}
              onCheckedChange={toggleRememberMe}
            />
            <label htmlFor="remember-session" className="cursor-pointer select-none text-xs text-muted-foreground">
              {t.login.rememberMe}
            </label>
          </div>
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => setIsForgotModalOpen(true)}
            className="h-auto min-h-0 px-0 text-xs"
          >
            {t.login.forgotPassword}
          </Button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isSubmitting}
          disabled={isCoolingDown}
          className="mt-2 w-full justify-center"
        >
          {isSubmitting ? t.login.submitting : t.login.submitButton}
        </Button>
      </form>
      )}

      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="max-w-sm p-3 sm:p-3.5">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-info-subtle p-2 text-info-subtle-foreground">
                <KeyRound className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm">{t.login.forgotPassword}</DialogTitle>
                <DialogDescription className="text-xs">{t.login.forgotModalDescription}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form method="post" onSubmit={handleForgotPassword} className="space-y-2.5" noValidate>
            {forgotError ? (
              <div
                ref={forgotErrorRef}
                role="alert"
                tabIndex={-1}
                className="rounded-lg border border-destructive/30 bg-destructive-subtle px-2.5 py-1.5 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {forgotError}
              </div>
            ) : null}
            <Field id="forgot-email" label={t.login.emailLabel} hideLabel error={forgotFieldError ?? undefined} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  ref={forgotEmailInputRef}
                  size="sm"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={`${t.login.emailLabel} *`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1.5">
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
