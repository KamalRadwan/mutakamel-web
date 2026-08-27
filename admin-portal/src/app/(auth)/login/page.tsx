"use client";

import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { Card, Field, Input, Checkbox, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system";
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
    toggleShowPassword,
    toggleRememberMe,
    handleSubmit,
    handleForgotPassword,
  } = useLogin();

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-canvas p-4 text-foreground sm:p-6">
      <div className="w-full max-w-md mx-auto my-auto py-8 z-10">
        <Card className="space-y-6 p-6 shadow-2xl sm:p-8">
          <div className="space-y-2 text-center">
            <div className="mb-2 inline-flex size-12 items-center justify-center rounded-xl bg-brand-500 text-ink-950">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{t.login.title}</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.login.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t.login.emailLabel}>
              {(fp) => (
                <div className="relative">
                  <Mail className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    {...fp}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="ps-10"
                  />
                </div>
              )}
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-start text-xs font-semibold text-foreground">{t.login.passwordLabel}</label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
                >
                  {t.login.forgotPassword}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="ps-10 pe-10"
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 pt-1">
              <Checkbox checked={rememberMe} onCheckedChange={toggleRememberMe} />
              <span className="text-xs font-medium text-muted-foreground">{t.login.rememberMe}</span>
            </label>

            <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full justify-center">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t.login.submitting}</span>
                </>
              ) : (
                <span>{t.login.submitButton}</span>
              )}
            </Button>
          </form>
        </Card>
      </div>

      <div className="z-10 w-full text-center text-xs text-muted-foreground">
        <p>{t.login.footerNote} · {t.common.portalName}</p>
      </div>

      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-500/10 p-2.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-sm">{t.login.forgotPassword}</DialogTitle>
                <p className="text-xs text-muted-foreground">{t.login.forgotModalDescription}</p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-3">
            <Field label={t.login.emailLabel}>
              {(fp) => <Input {...fp} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />}
            </Field>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsForgotModalOpen(false)}>
                {t.login.cancel}
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {t.login.sendResetLink}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
