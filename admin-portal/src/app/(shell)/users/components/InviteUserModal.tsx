"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import {
  FormDrawer,
  Field,
  Input,
  Combobox,
  Checkbox,
  Button,
  AmbiguousOutcomePanel,
} from "@/design-system";
import { useInviteUserModal } from "../hooks/useInviteUserModal";
import { RoleCatalogueFeedback } from "./RoleCatalogueFeedback";

export function InviteUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const {
    email,
    setEmail,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    roleId,
    setRoleId,
    isSuperAdmin,
    setIsSuperAdmin,
    isSubmitting,
    isAmbiguous,
    idempotencyKey,
    roles,
    rolesStatus,
    reloadRoles,
    fieldErrors,
    setFieldErrors,
    isDirty,
    handleSubmit,
  } = useInviteUserModal({ onClose, onSuccess });

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={t.users.inviteTitle}
      titleAr={t.users.inviteTitle}
      subtitleEn={t.users.inviteSubtitle}
      subtitleAr={t.users.inviteSubtitle}
      isSubmitting={isSubmitting || isAmbiguous}
      isDirty={isDirty}
      footerActions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting || isAmbiguous}>
            {t.users.cancel}
          </Button>
          <Button
            type="submit"
            form="invite-user-form"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={
              rolesStatus !== "success" || !email.trim() || !firstName.trim() || !lastName.trim() || !roles.some((role) => role.id === roleId)
            }
          >
            {isSubmitting ? t.users.sendingInvite : t.users.sendInvite}
          </Button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-2.5 py-1 text-xs">
        <div className="rounded-md border border-warning/30 bg-warning-subtle p-2 text-xs leading-relaxed text-warning-subtle-foreground">
          {t.users.invitedInfoBanner}
        </div>

        {isAmbiguous && (
          <AmbiguousOutcomePanel
            idempotencyKey={idempotencyKey}
            message={t.users.ambiguousInviteMessage}
            onRetryExact={() => void handleSubmit()}
            retrying={isSubmitting}
          />
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t.users.firstNameLabel} hideLabel required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                size="sm"
                maxLength={80}
                value={firstName}
                disabled={isAmbiguous}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={`${t.users.firstNameLabel} *`}
              />
            )}
          </Field>
          <Field label={t.users.lastNameLabel} hideLabel required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                size="sm"
                maxLength={80}
                value={lastName}
                disabled={isAmbiguous}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={`${t.users.lastNameLabel} *`}
              />
            )}
          </Field>
        </div>

        <Field label={t.users.emailLabel} hideLabel required error={fieldErrors.email || undefined}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              size="sm"
              type="email"
              maxLength={255}
              value={email}
              disabled={isAmbiguous}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: "" }));
              }}
              placeholder={`${t.users.emailLabel} *`}
            />
          )}
        </Field>

        <Field label={t.users.roleLabel} hideLabel required>
          {(fieldProps) => (
            <Combobox
              {...fieldProps}
              value={roleId}
              onValueChange={setRoleId}
              label={t.users.roleLabel}
              placeholder={`${t.users.roleLabel} *`}
              searchPlaceholder={t.users.rolesSearchPlaceholder}
              emptyLabel={t.users.rolesNoMatches}
              disabled={rolesStatus !== "success" || isAmbiguous}
              options={roles.map((role) => ({
                value: role.id,
                label: role.nameI18n?.[lang] || role.name,
                keywords: [role.name, role.nameI18n?.en ?? "", role.nameI18n?.ar ?? ""],
              }))}
            />
          )}
        </Field>
        <RoleCatalogueFeedback assignable status={rolesStatus} empty={roles.length === 0} onRetry={reloadRoles} />

        {user?.isSuperAdmin && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card p-2 text-xs font-semibold text-foreground">
            <Checkbox
              checked={isSuperAdmin}
              disabled={isAmbiguous}
              onCheckedChange={(c) => setIsSuperAdmin(c === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span>{t.users.superAdminCheckbox}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t.users.superAdminHint}
              </span>
            </span>
          </label>
        )}
      </form>
    </FormDrawer>
  );
}
