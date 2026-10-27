"use client";

import { Button, DetailSection, Field, Input } from "@/design-system";
import { useProfileSecurity } from "../hooks/useProfileSecurity";

export function ProfileSecurity() {
  const screen = useProfileSecurity();
  const { t } = screen;
  const copy = t.coreIdentity.profile;
  const passwordCopy = t.coreIdentity.actionToken;
  const disabled = screen.pending !== null;

  return (
    <>
      <DetailSection title={copy.ownName} description={copy.ownNameDescription}>
        <form method="post" className="flex flex-col gap-4" onSubmit={screen.submitName}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.firstName} required>
              <Input name="firstName" autoComplete="given-name" value={screen.firstName}
                onChange={(event) => screen.setFirstName(event.target.value)}
                maxLength={screen.maxNameLength} disabled={disabled} required />
            </Field>
            <Field label={copy.lastName} required>
              <Input name="lastName" autoComplete="family-name" value={screen.lastName}
                onChange={(event) => screen.setLastName(event.target.value)}
                maxLength={screen.maxNameLength} disabled={disabled} required />
            </Field>
          </div>
          {screen.nameError ? <p role="alert" className="text-sm text-negative-700 dark:text-negative-300">{screen.nameError.message ?? copy.securityFailed}</p> : null}
          <Button type="submit" variant="outline" className="self-start" loading={screen.pending === "name"}
            disabled={disabled || !screen.isNameValid}>{t.common.save}</Button>
        </form>
      </DetailSection>
      <DetailSection title={copy.changePassword} description={copy.changePasswordDescription}>
        <form method="post" className="flex flex-col gap-4" onSubmit={screen.submitPassword}>
          <Field label={copy.currentPassword} error={screen.passwordError?.code === "CURRENT_PASSWORD_INVALID" ? screen.passwordError.message ?? copy.securityFailed : undefined} required>
            <Input type={screen.showPassword ? "text" : "password"} name="currentPassword" autoComplete="current-password"
              value={screen.currentPassword} onChange={(event) => screen.setCurrentPassword(event.target.value)}
              maxLength={screen.maxPasswordLength} disabled={disabled} required />
          </Field>
          <Field label={passwordCopy.newPassword} hint={passwordCopy.passwordPolicy}
            error={screen.newPassword && !screen.isPasswordValid ? passwordCopy.passwordPolicy : undefined} required>
            <Input type={screen.showPassword ? "text" : "password"} name="newPassword" autoComplete="new-password"
              value={screen.newPassword} onChange={(event) => screen.setNewPassword(event.target.value)}
              maxLength={screen.maxPasswordLength} disabled={disabled} required />
          </Field>
          <Field label={passwordCopy.confirmPassword}
            error={screen.confirmPassword && !screen.isConfirmed ? passwordCopy.passwordMismatch : undefined} required>
            <Input type={screen.showPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password"
              value={screen.confirmPassword} onChange={(event) => screen.setConfirmPassword(event.target.value)}
              maxLength={screen.maxPasswordLength} disabled={disabled} required />
          </Field>
          <Button type="button" variant="ghost" className="self-start" onClick={screen.toggleShowPassword} aria-pressed={screen.showPassword}>
            {screen.showPassword ? t.auth.hidePassword : t.auth.showPassword}
          </Button>
          {screen.passwordError ? <p role="alert" className="text-sm text-negative-700 dark:text-negative-300">{screen.passwordError.message ?? copy.securityFailed}</p> : null}
          <Button type="submit" variant="outline" className="self-start" loading={screen.pending === "password"}
            disabled={disabled || !screen.currentPassword || !screen.isPasswordValid || !screen.isConfirmed}>{copy.changePassword}</Button>
        </form>
      </DetailSection>
    </>
  );
}
