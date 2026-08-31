"use client";

import { RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DegradedBanner,
  ErrorState,
  Field,
  Input,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
  Skeleton,
  SubNav,
  CORE_SETTINGS_NAV_ITEMS,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessModeLabels } from "../../hooks/useAccessModeLabels";
import { BRANDING_READ_PERMISSION } from "./branding-contract";
import { BrandingAssetCard } from "./components/BrandingAssetCard";
import { useBranding } from "./hooks/useBranding";

export default function BrandingSettingsPage() {
  return (
    <PermissionGate require={BRANDING_READ_PERMISSION}>
      <BrandingWorkspace />
    </PermissionGate>
  );
}

function BrandingWorkspace() {
  const { t } = useI18n();
  const accessLabels = useAccessModeLabels();
  const branding = useBranding();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.coreBilling.brandingTitle}
        description={t.coreBilling.brandingSubtitle}
        primaryAction={
          branding.canManage
            ? {
                label: t.coreBilling.brandingSave,
                onClick: () => void branding.save(),
                disabled: branding.isSaving || branding.isLoading,
                loading: branding.isSaving,
              }
            : undefined
        }
        secondaryActions={
          <Button
            variant="outline"
            onClick={() => void branding.reload()}
            disabled={branding.isRefreshing}
          >
            <RefreshCw
              className={branding.isRefreshing ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            {t.coreBilling.reload}
          </Button>
        }
      />

      <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

      {/* Read-only is not `disabled`: the values matter, they are readable, and
          they simply cannot be changed without `branding.manage`. The notice is
          overridden because the shared one names the *subscription* period as
          the reason, which is a different read-only entirely. */}
      <ReadOnlyGate
        mode={branding.canManage ? "FULL" : "READ_ONLY"}
        labels={{ ...accessLabels, readOnlyNotice: t.coreBilling.brandingReadOnlyNotice }}
      >
        {branding.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : branding.error ? (
          <ErrorState
            title={t.coreBilling.brandingLoadFailed}
            description={branding.error.correlationId}
            onRetry={() => void branding.reload()}
            retryLabel={t.common.retry}
          />
        ) : (
          <>
            {/* The runtime contrast guard. A colour that cannot reach the
                thresholds is never applied to the token layer, and the reason
                is stated here rather than silently dropped. */}
            {branding.contrast === null && branding.values.primaryColor.trim() !== "" && (
              <DegradedBanner message={t.coreBilling.brandingColorInvalid} />
            )}
            {branding.contrast && !branding.contrast.passes && (
              <DegradedBanner message={t.coreBilling.brandingContrastFallback} />
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t.coreBilling.brandingIdentity}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t.coreBilling.brandingAppName}
                  hint={t.coreBilling.brandingAppNameHint}
                  readOnly={!branding.canManage}
                >
                  <Input
                    value={branding.values.appName}
                    readOnly={!branding.canManage}
                    disabled={branding.isSaving}
                    onChange={(event) => branding.setValue({ appName: event.target.value })}
                  />
                </Field>
                <Field
                  label={t.coreBilling.brandingTabTitle}
                  hint={t.coreBilling.brandingTabTitleHint}
                  readOnly={!branding.canManage}
                >
                  <Input
                    value={branding.values.tabTitle}
                    readOnly={!branding.canManage}
                    disabled={branding.isSaving}
                    onChange={(event) => branding.setValue({ tabTitle: event.target.value })}
                  />
                </Field>
                <Field
                  label={t.coreBilling.brandingPrimaryColor}
                  hint={t.coreBilling.brandingPrimaryColorHint}
                  error={branding.formError ?? undefined}
                  readOnly={!branding.canManage}
                >
                  <Input
                    value={branding.values.primaryColor}
                    readOnly={!branding.canManage}
                    disabled={branding.isSaving}
                    placeholder="#2563eb"
                    onChange={(event) => branding.setValue({ primaryColor: event.target.value })}
                  />
                </Field>
                <Field
                  label={t.coreBilling.brandingSecondaryColor}
                  hint={t.coreBilling.brandingSecondaryColorHint}
                  readOnly={!branding.canManage}
                >
                  <Input
                    value={branding.values.secondaryColor}
                    readOnly={!branding.canManage}
                    disabled={branding.isSaving}
                    onChange={(event) => branding.setValue({ secondaryColor: event.target.value })}
                  />
                </Field>
                <Field
                  label={t.coreBilling.brandingFontFamily}
                  hint={t.coreBilling.brandingFontFamilyHint}
                  readOnly={!branding.canManage}
                  className="sm:col-span-2"
                >
                  <Input
                    value={branding.values.fontFamily}
                    readOnly={!branding.canManage}
                    disabled={branding.isSaving}
                    onChange={(event) => branding.setValue({ fontFamily: event.target.value })}
                  />
                </Field>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <BrandingAssetCard
                kind="logo"
                title={t.coreBilling.brandingLogo}
                hasAsset={branding.branding?.hasLogo ?? false}
                assetVersion={branding.assetVersion}
                isUploading={branding.uploading === "logo"}
                error={branding.uploadError.logo}
                disabled={!branding.canManage}
                onUpload={(file) => void branding.upload("logo", file)}
                onReject={(message) => branding.rejectUpload("logo", message)}
              />
              <BrandingAssetCard
                kind="icon"
                title={t.coreBilling.brandingIcon}
                hasAsset={branding.branding?.hasIcon ?? false}
                assetVersion={branding.assetVersion}
                isUploading={branding.uploading === "icon"}
                error={branding.uploadError.icon}
                disabled={!branding.canManage}
                onUpload={(file) => void branding.upload("icon", file)}
                onReject={(message) => branding.rejectUpload("icon", message)}
              />
            </div>
          </>
        )}
      </ReadOnlyGate>
    </div>
  );
}
