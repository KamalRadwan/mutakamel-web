"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  Field,
  Input,
  LanguageToggle,
  ThemeToggle,
} from "@/design-system";
import {
  NEW_PASSWORD_MAX_LENGTH,
  useActionTokenPassword,
  type ActionTokenFlow,
} from "../hooks/useActionTokenPassword";

export function ActionTokenScreen({ flow }: { flow: ActionTokenFlow }) {
  const screen = useActionTokenPassword(flow);
  const { t } = screen;
  const copy = t.coreIdentity.actionToken;
  const flowCopy = copy.flows[flow];
  const isSubmitting = screen.state === "submitting";

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-4">
      <div className="flex justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
        <div className="w-full max-w-[420px] rounded-md border border-border bg-card p-6">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-foreground">{flowCopy.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{flowCopy.subtitle}</p>
          </div>

          {screen.state === "missing-token" ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">{copy.missingTokenTitle}</p>
              <p className="text-xs text-muted-foreground">{copy.missingTokenDescription}</p>
              <Button variant="primary" asChild>
                <Link href="/login">{copy.goToLogin}</Link>
              </Button>
            </div>
          ) : screen.state === "rejected" ? (
            // The backend answers `400 INVALID_ACTION_TOKEN` for all three of
            // expired, already-consumed and revoked — one branch in
            // `findUsableActionToken`, one code on the wire. Naming all three
            // is the honest surface; picking one would be a guess.
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">{copy.rejectedTitle}</p>
              <ul className="flex list-none flex-col gap-1 text-xs text-muted-foreground">
                <li>{copy.rejectedExpired}</li>
                <li>{copy.rejectedConsumed}</li>
                <li>{copy.rejectedRevoked}</li>
              </ul>
              <p className="text-xs text-muted-foreground">{flowCopy.rejectedNextStep}</p>
              {screen.error?.correlationId ? (
                <p className="font-mono text-2xs text-muted-foreground">
                  {t.errors.reference}: {screen.error.correlationId}
                </p>
              ) : null}
              <Button variant="primary" asChild>
                <Link href="/login">{copy.goToLogin}</Link>
              </Button>
            </div>
          ) : (
            <form
              // See the note on the sign-in form in src/app/login/page.tsx: a
              // form with no method defaults to GET, and this one carries a new
              // password and an action token.
              method="post"
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void screen.submit();
              }}
            >
              <Field
                label={copy.newPassword}
                hint={copy.passwordPolicy}
                error={
                  screen.newPassword.length > 0 && !screen.isPasswordValid
                    ? copy.passwordPolicy
                    : undefined
                }
                required
              >
                <div className="relative">
                  <Input
                    type={screen.showPassword ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    size="lg"
                    value={screen.newPassword}
                    onChange={(event) => screen.setNewPassword(event.target.value)}
                    maxLength={NEW_PASSWORD_MAX_LENGTH}
                    className="pe-9"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={screen.toggleShowPassword}
                    aria-pressed={screen.showPassword}
                    aria-label={screen.showPassword ? t.auth.hidePassword : t.auth.showPassword}
                    className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {screen.showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </Field>

              <Field
                label={copy.confirmPassword}
                error={
                  screen.confirmPassword.length > 0 && !screen.isConfirmed
                    ? copy.passwordMismatch
                    : undefined
                }
                required
              >
                <Input
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  size="lg"
                  value={screen.confirmPassword}
                  onChange={(event) => screen.setConfirmPassword(event.target.value)}
                  maxLength={NEW_PASSWORD_MAX_LENGTH}
                  required
                />
              </Field>

              {screen.error ? (
                <p
                  role="alert"
                  className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
                >
                  {screen.error.message ?? copy.genericFailure}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={!screen.isPasswordValid || !screen.isConfirmed || isSubmitting}
                className="w-full"
              >
                {flowCopy.submit}
              </Button>
            </form>
          )}
        </div>
      </main>

      <p className="pb-2 text-center text-2xs text-muted-foreground">{t.auth.footer}</p>
    </div>
  );
}
