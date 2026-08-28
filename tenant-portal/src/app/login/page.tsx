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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label={t.auth.emailLabel} required>
              <Input
                type="email"
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
                    size="lg"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pe-9"
                    required
                  />
                  {/* Button's chrome doesn't fit a borderless icon overlaid
                      on the input itself. */}
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">{t.auth.passwordLabel}</span>
                  </button>
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
