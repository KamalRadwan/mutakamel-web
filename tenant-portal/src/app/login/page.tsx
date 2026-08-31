"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  LanguageToggle,
  ThemeToggle,
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
    isForgotModalOpen,
    setIsForgotModalOpen,
    openForgotModal,
    resetEmail,
    setResetEmail,
    failure,
    failureKind,
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  } = useLogin();

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-4">
      <div className="flex justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
        <div className="flex size-7 items-center justify-center rounded-sm bg-brand-600 text-sm font-semibold text-white">
          M
        </div>

        <div className="w-full max-w-[380px] rounded-md border border-border bg-card p-6">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">{t.auth.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{t.auth.subtitle}</p>
          </div>

          {/* B9 / WCAG 2.2 `accessible-authentication`. A password manager
              needs three things and this form gives all three: a real <form>
              wrapping both fields, a `name` on each control, and the
              `autocomplete` tokens below. `name` matters as much as
              `autocomplete` — several managers key their heuristics off it.
              Paste is never blocked; there is no onPaste handler anywhere on
              this page and there must never be one.
              docs/design/DESIGN-SYSTEM.md#71-login--login. */}
          {/* 4.31 — in-body, not a toast: the next step differs per failure and
              a toast disappears before it can be read. */}
          {failureKind ? (
            <div
              role="alert"
              className="mb-4 flex flex-col gap-1 rounded-sm border border-negative-200 bg-negative-100 p-3 text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
            >
              <p className="text-xs font-medium">{t.coreIdentity.loginFailure[failureKind].title}</p>
              <p className="text-2xs">{t.coreIdentity.loginFailure[failureKind].description}</p>
              {failure?.correlationId ? (
                <p className="font-mono text-2xs">
                  {t.errors.reference}: {failure.correlationId}
                </p>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label={t.auth.emailLabel} required>
              <Input
                type="email"
                name="email"
                autoComplete="username"
                size="lg"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <Field label={t.auth.passwordLabel} required>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    size="lg"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pe-9"
                    required
                  />
                  {/* `ghost` has no chrome to fight with — bg-transparent,
                      no border — so this overlay control is a real Button
                      rather than raw markup, and it inherits the focus ring,
                      the pointer cursor and the hit-area expansion for free.
                      The accessible name has to say what the control DOES; it
                      previously read "Password", which is the field's name,
                      not the toggle's. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={toggleShowPassword}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                    className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </Field>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={openForgotModal}
                className="self-start text-xs"
              >
                {t.auth.forgotPassword}
              </Button>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox checked={rememberMe} onCheckedChange={toggleRememberMe} />
              <span className="text-xs text-muted-foreground">{t.auth.rememberMe}</span>
            </label>

            <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="w-full">
              {isSubmitting ? t.auth.submitting : t.auth.submit}
            </Button>
          </form>
        </div>
      </div>

      <p className="pb-2 text-center text-2xs text-muted-foreground">{t.auth.footer}</p>

      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.auth.resetTitle}</DialogTitle>
            <DialogDescription>{t.auth.resetDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <Field label={t.auth.emailLabel} required>
              <Input
                type="email"
                name="resetEmail"
                autoComplete="email"
                placeholder={t.auth.resetEmailPlaceholder}
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsForgotModalOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {t.auth.resetSubmit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
