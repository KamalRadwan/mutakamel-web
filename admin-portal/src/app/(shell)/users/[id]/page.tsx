"use client";

import { use, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  User,
  PhoneCall,
  Save,
  Lock,
  Eye,
  EyeOff,
  Ban,
  RefreshCw,
  Shield,
  AlertCircle,
  Trash2,
} from "lucide-react";
import {
  PageHeader,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Field,
  Input,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/design-system";
import { useUserDetail } from "../hooks/useUserDetail";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { UserMetadataCard } from "../components/UserMetadataCard";
import { UserProfileCard } from "../components/UserProfileCard";
import { WebphoneSummaryCard } from "../components/WebphoneSummaryCard";
import { WebphoneServerChainCard } from "../components/WebphoneServerChainCard";
import { UserNotFoundState } from "../components/UserNotFoundState";
import { UserPermissionDenied } from "../components/UserPermissionDenied";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    lang,
    t,
    router,
    user,
    isLoading,
    isSaving,
    notFound,
    permissionDenied,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    isSuperAdmin,
    setIsSuperAdmin,
    assignedRoleId,
    setAssignedRoleId,
    availableRoles,
    status,

    identityHasChanges,
    roleHasChanges,
    webphoneHasChanges,

    webphoneEnabled,
    setWebphoneEnabled,
    sipExtension,
    setSipExtension,
    sipUsername,
    setSipUsername,
    sipPassword,
    setSipPassword,
    webphoneDisplayName,
    setWebphoneDisplayName,
    outboundCallerId,
    setOutboundCallerId,
    passwordConfigured,

    webphoneExtension,
    extensionError,
    sipUsernameError,

    webphoneServers,
    serverChainRows,
    serverChainErrors,
    serverChainHasChanges,
    canEditServerChain,
    moveServerChainRow,
    updateServerChainRow,
    addServerToChain,
    removeServerFromChain,
    resetServerChain,
    saveServerChain,

    saveIdentity,
    saveRole,
    saveWebphone,
    handleStatusChange,
    handleDelete,
  } = useUserDetail(id);

  const permissions = useUserPermissions(id, status);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [isEditingWebphone, setIsEditingWebphone] = useState(false);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <RefreshCw className="size-5 animate-spin text-info motion-reduce:animate-none" aria-hidden="true" />
          {t.users.loadingUserDetails}
        </span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full">
        <UserNotFoundState />
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="w-full">
        <UserPermissionDenied />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={`${firstName} ${lastName}`}
        description={email}
        status={
          <>
            <Badge tone={isSuperAdmin ? "danger" : "neutral"} className="font-mono">
              {isSuperAdmin ? "SUPER_ADMIN" : "ADMIN"}
            </Badge>
            {permissions.isSelf && <Badge tone="brand">{t.users.youBadge}</Badge>}
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/users")}>
              {lang === "ar" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
              {t.users.usersNavLabel}
            </Button>
            {permissions.canSuspend && (
              <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => handleStatusChange("SUSPENDED")}>
                <Ban className="size-3.5" />
                {t.users.suspendAccount}
              </Button>
            )}
            {permissions.canActivate && (
              <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => handleStatusChange("ACTIVE")}>
                <RefreshCw className="size-3.5" />
                {t.users.activateAccount}
              </Button>
            )}
            {permissions.canDelete && (
              <Button type="button" variant="destructive" size="sm" disabled={isSaving} onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 className="size-3.5" />
                {t.users.delete}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="size-4 text-info" aria-hidden="true" />
                {t.users.identityProfile}
              </CardTitle>
              {identityHasChanges && permissions.canEdit && <Badge tone="warn">{t.users.unsavedBadge}</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label={t.users.firstNameLabel}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    maxLength={80}
                    disabled={!permissions.canEdit || isSaving}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t.users.lastNameLabel}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    maxLength={80}
                    disabled={!permissions.canEdit || isSaving}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t.users.emailLabel} hint={t.users.emailImmutable}>
                {(fieldProps) => (
                  <div className="relative">
                    <Input {...fieldProps} disabled type="email" value={email} className="pe-9 font-mono" />
                    <Lock className="absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                )}
              </Field>

              {permissions.isCurrentSuperAdmin && (
                <label
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
                    isSuperAdmin ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground" : "border-border bg-card text-foreground"
                  } ${!permissions.canEdit || isSaving ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <Checkbox
                    checked={isSuperAdmin}
                    onCheckedChange={(c) => setIsSuperAdmin(c === true)}
                    disabled={!permissions.canEdit || isSaving}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span>{t.users.superAdminPrivilegesLabel}</span>
                    <span className="text-xs font-normal opacity-80">
                      {t.users.superAdminPrivilegesHint}
                    </span>
                  </span>
                </label>
              )}
            </CardContent>
            {permissions.canEdit && identityHasChanges && (
              <CardFooter>
                <Button type="button" variant="primary" size="sm" onClick={saveIdentity} disabled={isSaving} loading={isSaving} className="flex-1">
                  <Save className="size-3.5" />
                  {t.users.saveChanges}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => {
                    if (user) {
                      setFirstName(user.firstName);
                      setLastName(user.lastName);
                      setIsSuperAdmin(user.isSuperAdmin);
                    }
                  }}
                >
                  {t.users.discardChanges}
                </Button>
              </CardFooter>
            )}
          </Card>

          {user && <UserMetadataCard user={user} />}
          <UserProfileCard profile={user?.profile} />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="size-4 text-info" aria-hidden="true" />
                {t.users.assignedRoleTitle}
              </CardTitle>
              {roleHasChanges && permissions.canAssignRole && <Badge tone="warn">{t.users.unsavedRoleBadge}</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label={t.users.roleLabel}>
                {(fieldProps) => (
                  <Select
                    value={assignedRoleId ?? ""}
                    onValueChange={(v) => setAssignedRoleId(v || undefined)}
                    disabled={!permissions.canAssignRole || permissions.isSelf || isSaving}
                  >
                    <SelectTrigger {...fieldProps}>
                      <SelectValue placeholder={t.users.selectRolePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.nameI18n?.[lang] || role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              {assignedRoleId && availableRoles.find((r) => r.id === assignedRoleId)?.description && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {availableRoles.find((r) => r.id === assignedRoleId)?.description}
                </p>
              )}

              <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-subtle p-3 text-warning-subtle-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-xs leading-relaxed">{t.users.roleChangeWarning}</p>
              </div>
            </CardContent>
            {permissions.canAssignRole && !permissions.isSelf && roleHasChanges && (
              <CardFooter>
                <Button type="button" variant="primary" size="sm" onClick={saveRole} disabled={isSaving} loading={isSaving}>
                  <Save className="size-3.5" />
                  {t.users.applyRoleAssignment}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setAssignedRoleId(user?.roleId ?? user?.role?.id ?? undefined)}
                >
                  {t.users.discardChanges}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Without the WebPhone module's read permission the extension is
              never fetched, so the card would report every user as
              unconfigured — say nothing rather than something false. */}
          {!permissions.canViewWebphone ? null : !isEditingWebphone ? (
            <WebphoneSummaryCard
              webphone={webphoneExtension}
              canEdit={permissions.canEditWebphone}
              onEditToggle={() => setIsEditingWebphone(true)}
            />
          ) : (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <PhoneCall className="size-4 text-info" aria-hidden="true" />
                    {t.users.webphoneConfig}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.users.webphoneCredentialsHint}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
                    <Checkbox checked={webphoneEnabled} onCheckedChange={(c) => setWebphoneEnabled(c === true)} />
                    {t.users.enablePhone}
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingWebphone(false)}>
                    {t.users.cancelEdit}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label={t.users.sipExtension} error={extensionError ?? undefined}>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      maxLength={32}
                      value={sipExtension}
                      onChange={(e) => setSipExtension(e.target.value)}
                      placeholder="7001"
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field label={t.users.sipUsernameLabel} error={sipUsernameError ?? undefined}>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      maxLength={120}
                      value={sipUsername}
                      onChange={(e) => setSipUsername(e.target.value)}
                      placeholder="7001"
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field
                  label={t.users.sipPasswordLabel}
                  hint={passwordConfigured ? t.users.keepCurrentPasswordHint : t.users.passwordRequiredHint}
                  labelAction={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={
                        showSipPassword
                          ? t.authActions.common.hidePassword
                          : t.authActions.common.showPassword
                      }
                      aria-pressed={showSipPassword}
                      onClick={() => setShowSipPassword((visible) => !visible)}
                      className="h-auto px-1.5 py-1"
                    >
                      {showSipPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  }
                >
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type={showSipPassword ? "text" : "password"}
                      maxLength={255}
                      value={sipPassword}
                      onChange={(e) => setSipPassword(e.target.value)}
                      placeholder={passwordConfigured ? "••••••••••••" : ""}
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field label={t.users.displayNameLabel}>
                  {(fieldProps) => (
                    <Input {...fieldProps} maxLength={120} value={webphoneDisplayName} onChange={(e) => setWebphoneDisplayName(e.target.value)} />
                  )}
                </Field>
                <Field label={t.users.outboundCallerIdLabel}>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      maxLength={64}
                      value={outboundCallerId}
                      onChange={(e) => setOutboundCallerId(e.target.value)}
                      placeholder="+201001234567"
                      className="font-mono"
                    />
                  )}
                </Field>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-xs text-muted-foreground">
                  {passwordConfigured ? t.users.passwordConfigured : t.users.noPasswordConfigured}
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!webphoneHasChanges || isSaving}
                  loading={isSaving}
                  onClick={async () => {
                    await saveWebphone();
                    setIsEditingWebphone(false);
                  }}
                >
                  <Save className="size-3.5" />
                  {t.users.savePhoneSettings}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* The chain is the user's failover order over the servers from
              Settings → WebPhone, so it is shown wherever the identity is —
              but only to an operator allowed to read the module at all. */}
          {permissions.canViewWebphone && (
            <WebphoneServerChainCard
              servers={webphoneServers}
              rows={serverChainRows}
              errors={serverChainErrors}
              hasChanges={serverChainHasChanges}
              canEdit={permissions.canEditWebphone && canEditServerChain}
              isSaving={isSaving}
              onMove={moveServerChainRow}
              onUpdateRow={updateServerChainRow}
              onAdd={addServerToChain}
              onRemove={removeServerFromChain}
              onReset={resetServerChain}
              onSave={() => void saveServerChain()}
            />
          )}
        </div>
      </div>

      <DestructiveActionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          void handleDelete();
        }}
        title={t.users.deleteAccountTitle}
        targetName={`${firstName} ${lastName}`.trim() || email}
        actionType="delete"
        description={t.users.deleteAccountDescription}
        isSubmitting={isSaving}
      />
    </div>
  );
}
