"use client";

import {
  Button,
  DetailSection,
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
  Switch,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreOperationsErrorText } from "../../hooks/useCoreOperationsErrorText";
import { DIRECTORY_SETTINGS_PERMISSION } from "../directory-contract";
import { DUPLICATE_SCOPES } from "./directory-settings-contract";
import { useDirectorySettings } from "./hooks/useDirectorySettings";

export default function DirectorySettingsPage() {
  const {
    t,
    values,
    isLoading,
    isSaving,
    isDirty,
    loadError,
    formError,
    change,
    revert,
    save,
    reload,
  } = useDirectorySettings();
  const copy = t.coreOperations.directory;
  const describeError = useCoreOperationsErrorText();

  return (
    <PermissionGate require={DIRECTORY_SETTINGS_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.settingsTitle}
          description={copy.settingsSubtitle}
          breadcrumbs={[
            { label: copy.listTitle, href: TENANT_ROUTES.coreDirectory },
            { label: copy.settingsTitle },
          ]}
          primaryAction={{
            label: t.common.save,
            onClick: () => void save(),
            disabled: !isDirty || isLoading,
            loading: isSaving,
          }}
          secondaryActions={
            <Button variant="outline" onClick={revert} disabled={!isDirty || isSaving}>
              {copy.settingsRevert}
            </Button>
          }
        />

        {loadError ? (
          <ErrorState
            title={copy.settingsLoadFailed}
            description={describeError(loadError)}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <DetailSection
              title={copy.settingsDuplicateTitle}
              description={copy.settingsDuplicateDescription}
            >
              <div className="flex flex-col gap-4">
                <Field label={copy.settingsScope} hint={copy.settingsScopeHint}>
                  <Select
                    value={values.duplicateScope}
                    onValueChange={(value) =>
                      change({ duplicateScope: value as typeof values.duplicateScope })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUPLICATE_SCOPES.map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {copy.duplicateScopes[scope]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={copy.settingsPreventEmail} hint={copy.settingsPreventEmailHint}>
                  <Switch
                    checked={values.preventDuplicateEmail}
                    onCheckedChange={(checked) => change({ preventDuplicateEmail: checked })}
                    disabled={isSaving}
                  />
                </Field>

                <Field label={copy.settingsPreventPhone} hint={copy.settingsPreventPhoneHint}>
                  <Switch
                    checked={values.preventDuplicatePhone}
                    onCheckedChange={(checked) => change({ preventDuplicatePhone: checked })}
                    disabled={isSaving}
                  />
                </Field>

                <Field
                  label={copy.settingsPreventWhatsapp}
                  hint={copy.settingsPreventWhatsappHint}
                >
                  <Switch
                    checked={values.preventDuplicateWhatsapp}
                    onCheckedChange={(checked) => change({ preventDuplicateWhatsapp: checked })}
                    disabled={isSaving}
                  />
                </Field>
              </div>
            </DetailSection>

            <DetailSection
              title={copy.settingsLimitsTitle}
              description={copy.settingsLimitsDescription}
            >
              <div className="flex flex-col gap-4">
                <Field
                  label={copy.settingsMaxContacts}
                  hint={copy.settingsMaxContactsHint}
                  error={formError ?? undefined}
                >
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={values.maxContactMethodsPerParty}
                    onChange={(event) =>
                      change({ maxContactMethodsPerParty: event.target.value })
                    }
                    disabled={isSaving}
                  />
                </Field>

                <Field label={copy.settingsMaxAddresses} hint={copy.settingsMaxAddressesHint}>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={values.maxAddressesPerParty}
                    onChange={(event) => change({ maxAddressesPerParty: event.target.value })}
                    disabled={isSaving}
                  />
                </Field>

                <Field label={copy.settingsCacheTtl} hint={copy.settingsCacheTtlHint}>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={values.partyCacheTtlSeconds}
                    onChange={(event) => change({ partyCacheTtlSeconds: event.target.value })}
                    disabled={isSaving}
                  />
                </Field>
              </div>
            </DetailSection>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
