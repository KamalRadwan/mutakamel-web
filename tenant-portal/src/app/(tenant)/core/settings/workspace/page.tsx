"use client";

import { Clock8, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Combobox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  PermissionGate,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  SubNav,
  Switch,
  CORE_SETTINGS_NAV_ITEMS,
} from "@/design-system";
import {
  CURRENCY_CODE_LENGTH,
  TIMEZONE_MAX_LENGTH,
  WORKSPACE_LANGUAGES,
} from "./workspace-settings-contract";
import { useTimezoneOptions } from "./hooks/useTimezoneOptions";
import { useWorkspaceSettings } from "./hooks/useWorkspaceSettings";

export default function WorkspaceSettingsPage() {
  const {
    t,
    canManage,
    draft,
    currencyOptions,
    isLoading,
    isSaving,
    isNotReady,
    loadError,
    fieldError,
    canSave,
    updateDraft,
    save,
    reload,
  } = useWorkspaceSettings();
  const timezones = useTimezoneOptions(draft?.timezone ?? "");
  const isReadOnly = !canManage;

  return (
    <PermissionGate require="workspace.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreSettings.workspaceTitle}
          description={t.coreSettings.workspaceSubtitle}
          primaryAction={
            canManage && draft
              ? {
                  label: t.coreSettings.save,
                  onClick: () => void save(),
                  disabled: !canSave || isSaving,
                  loading: isSaving,
                }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
              <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              {t.coreSettings.reload}
            </Button>
          }
        />

        <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

        {isLoading && !draft ? <WorkspaceSkeleton /> : null}

        {isNotReady ? (
          <EmptyState
            icon={Clock8}
            title={t.coreSettings.workspaceNotReadyTitle}
            description={t.coreSettings.workspaceNotReadyDescription}
            action={{ label: t.coreSettings.reload, onClick: () => void reload() }}
          />
        ) : null}

        {loadError ? (
          <ErrorState
            title={t.coreSettings.workspaceLoadFailed}
            description={loadError.message}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {draft ? (
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Field
                label={t.coreSettings.workspaceLanguage}
                hint={t.coreSettings.workspaceLanguageHint}
                error={fieldError?.field === "defaultLanguage" ? fieldError.message : undefined}
                readOnly={isReadOnly}
              >
                <Select
                  value={draft.defaultLanguage}
                  onValueChange={(value) => updateDraft({ defaultLanguage: value })}
                  disabled={isReadOnly || isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSPACE_LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>
                        {t.coreSettings.languageNames[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label={t.coreSettings.workspaceTimezone}
                hint={t.coreSettings.workspaceTimezoneHint}
                error={fieldError?.field === "timezone" ? fieldError.message : undefined}
                readOnly={isReadOnly}
                required
              >
                {timezones.hasZones ? (
                  <Combobox
                    value={draft.timezone}
                    selectedLabel={draft.timezone}
                    onValueChange={(value) => updateDraft({ timezone: value ?? "" })}
                    options={timezones.options}
                    onSearch={timezones.onSearch}
                    placeholder={t.coreSettings.workspaceTimezonePlaceholder}
                    searchPlaceholder={t.coreSettings.workspaceTimezoneSearch}
                    loadingLabel={t.common.loading}
                    emptyLabel={t.coreSettings.workspaceTimezoneEmpty}
                    disabled={isReadOnly || isSaving}
                    readOnly={isReadOnly}
                  />
                ) : (
                  <Input
                    value={draft.timezone}
                    onChange={(event) => updateDraft({ timezone: event.target.value })}
                    maxLength={TIMEZONE_MAX_LENGTH}
                    disabled={isSaving}
                    readOnly={isReadOnly}
                    dir="ltr"
                  />
                )}
              </Field>

              <Field
                label={t.coreSettings.workspaceCurrency}
                hint={t.coreSettings.workspaceCurrencyHint}
                error={fieldError?.field === "defaultCurrencyCode" ? fieldError.message : undefined}
                readOnly={isReadOnly}
              >
                {currencyOptions.length > 0 ? (
                  <Select
                    value={draft.defaultCurrencyCode}
                    onValueChange={(value) => updateDraft({ defaultCurrencyCode: value })}
                    disabled={isReadOnly || isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.coreSettings.workspaceCurrencyPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {`${currency.code} — ${currency.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={draft.defaultCurrencyCode}
                    onChange={(event) =>
                      updateDraft({ defaultCurrencyCode: event.target.value.toUpperCase() })
                    }
                    maxLength={CURRENCY_CODE_LENGTH}
                    disabled={isSaving}
                    readOnly={isReadOnly}
                    dir="ltr"
                  />
                )}
              </Field>

              <Field
                label={t.coreSettings.workspaceAllowSupport}
                hint={t.coreSettings.workspaceAllowSupportHint}
                readOnly={isReadOnly}
              >
                <Switch
                  checked={draft.allowSupport}
                  onCheckedChange={(checked) => updateDraft({ allowSupport: checked })}
                  disabled={isReadOnly || isSaving}
                />
              </Field>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PermissionGate>
  );
}

function WorkspaceSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}
