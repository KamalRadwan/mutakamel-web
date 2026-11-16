"use client";

import { Eye, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmActionModal,
  DegradedBanner,
  ErrorState,
  Field,
  Input,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { BRANDING_TEXT_MAX_LENGTH } from "@/lib/branding/public-branding";
import { useAccessModeLabels } from "../../hooks/useAccessModeLabels";
import { BRANDING_READ_PERMISSION, type BrandingFormValues } from "./branding-contract";
import { BrandingAssetCard } from "./components/BrandingAssetCard";
import { BrandingColorsCard } from "./components/BrandingColorsCard";
import { BrandingPreviewModal } from "./components/BrandingPreviewModal";
import { BrandingUploadModal } from "./components/BrandingUploadModal";
import { useBranding } from "./hooks/useBranding";

const SUMMARY_FIELD_ORDER = ["appName", "tabTitle", "primaryColor", "secondaryColor"] as const;

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
  const {
    setErrorSummaryNode, setAppNameNode, setTabTitleNode,
    setPrimaryColorNode, setSecondaryColorNode, ...branding
  } = useBranding();

  const fieldLabels: Record<keyof BrandingFormValues, string> = {
    appName: t.coreBilling.brandingAppName,
    tabTitle: t.coreBilling.brandingTabTitle,
    primaryColor: t.coreBilling.brandingPrimaryColor,
    secondaryColor: t.coreBilling.brandingSecondaryColor,
  };
  const errorSummaryEntries = SUMMARY_FIELD_ORDER.flatMap((field) => {
    const message = branding.fieldErrors[field];
    return message ? [{ field, label: fieldLabels[field], message }] : [];
  });
  const controlsDisabled = branding.isBusy || branding.isRefreshing;
  const hasLogo = branding.branding?.hasLogo ?? false;
  const hasIcon = branding.branding?.hasIcon ?? false;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        className="sr-only"
        title={t.coreBilling.brandingTitle}
        primaryAction={
          branding.canManage && branding.activeUploadKind === null
            ? {
                label: t.coreBilling.brandingSave,
                onClick: branding.attemptSave,
                disabled: !branding.canSave,
                loading: branding.isSaving,
              }
            : undefined
        }
        secondaryActions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => branding.setPreviewOpen(true)}
              disabled={branding.isLoading || branding.hasLoadError || branding.isDenied}
            >
              <Eye className="size-4" aria-hidden="true" />
              {t.coreSettings.brandingUi.previewAction}
            </Button>
            {branding.canManage && (
              <Button size="sm" variant="outline" onClick={branding.discard} disabled={!branding.canDiscard}>
                {t.common.discardConfirm}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={branding.reload} disabled={controlsDisabled}>
              <RefreshCw className={branding.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              {t.coreBilling.reload}
            </Button>
          </>
        }
      />

      {branding.isDenied ? (
        <PermissionGate require={BRANDING_READ_PERMISSION} denied>
          {null}
        </PermissionGate>
      ) : (
        /* Read-only is not `disabled`: values remain readable at full contrast
           and simply cannot be edited without `branding.manage`. */
        <ReadOnlyGate
          mode={branding.canManage ? "FULL" : "READ_ONLY"}
          labels={{ ...accessLabels, readOnlyNotice: t.coreBilling.brandingReadOnlyNotice }}
        >
          {branding.isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : branding.hasLoadError ? (
            <ErrorState
              title={t.coreBilling.brandingLoadFailed}
              description={branding.loadErrorDescription}
              onRetry={branding.reload}
              retryLabel={t.common.retry}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {branding.formError && <DegradedBanner message={branding.formError} />}

              {branding.submitAttempted && errorSummaryEntries.length > 0 && (
                <div
                  ref={setErrorSummaryNode}
                  id="branding-error-summary"
                  role="alert"
                  tabIndex={-1}
                  className="flex flex-col gap-1.5 rounded-lg border border-destructive bg-destructive-subtle px-3 py-2.5 text-xs text-destructive-subtle-foreground"
                >
                  <p className="font-semibold">{t.coreSettings.brandingUi.formErrorSummary}</p>
                  <ul className="list-disc ps-4">
                    {errorSummaryEntries.map(({ field, label, message }) => (
                      <li key={field}>
                        <a
                          href={`#branding-field-${field}`}
                          onClick={(event) => {
                            event.preventDefault();
                            branding.focusField(field);
                          }}
                          className="underline underline-offset-2 hover:opacity-80"
                        >
                          {`${label}: ${message}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form
                noValidate
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  branding.attemptSave();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
                    event.preventDefault();
                    branding.attemptSave();
                  }
                }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{t.coreBilling.brandingIdentity}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Field
                      showLabel
                      label={t.coreBilling.brandingAppName}
                      error={branding.fieldErrors.appName}
                      readOnly={!branding.canManage}
                    >
                      <Input
                        ref={setAppNameNode}
                        size="sm"
                        value={branding.values.appName}
                        maxLength={BRANDING_TEXT_MAX_LENGTH}
                        readOnly={!branding.canManage}
                        disabled={controlsDisabled}
                        onChange={(event) => branding.setValue({ appName: event.target.value })}
                      />
                    </Field>
                    <Field
                      showLabel
                      label={t.coreBilling.brandingTabTitle}
                      error={branding.fieldErrors.tabTitle}
                      readOnly={!branding.canManage}
                    >
                      <Input
                        ref={setTabTitleNode}
                        size="sm"
                        value={branding.values.tabTitle}
                        maxLength={BRANDING_TEXT_MAX_LENGTH}
                        readOnly={!branding.canManage}
                        disabled={controlsDisabled}
                        onChange={(event) => branding.setValue({ tabTitle: event.target.value })}
                      />
                    </Field>
                  </CardContent>
                </Card>

                <BrandingColorsCard
                  values={branding.values}
                  fieldErrors={branding.fieldErrors}
                  contrast={branding.contrast}
                  canManage={branding.canManage}
                  disabled={controlsDisabled}
                  primaryColorRef={setPrimaryColorNode}
                  secondaryColorRef={setSecondaryColorNode}
                  onChange={branding.setValue}
                />
              </form>

              <Card>
                <CardHeader>
                  <CardTitle>{t.coreSettings.brandingUi.assetsTitle}</CardTitle>
                  {branding.canManage && (
                    <CardDescription>{t.coreBilling.brandingAssetImmediateHint}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {(["logo", "icon"] as const).map((kind) => (
                    <BrandingAssetCard
                      key={kind}
                      kind={kind}
                      title={
                        kind === "logo" ? t.coreBilling.brandingLogo : t.coreBilling.brandingIcon
                      }
                      hasAsset={kind === "logo" ? hasLogo : hasIcon}
                      assetVersion={branding.assetVersion}
                      isUploading={branding.uploading === kind}
                      error={branding.activeUploadKind === kind ? null : branding.uploadError[kind]}
                      canManage={branding.canManage}
                      disabled={controlsDisabled}
                      onOpenUpload={() => branding.openUploadModal(kind)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </ReadOnlyGate>
      )}

      <BrandingUploadModal
        open={branding.activeUploadKind !== null}
        kind={branding.activeUploadKind}
        hasLogo={hasLogo}
        hasIcon={hasIcon}
        assetVersion={branding.assetVersion}
        isUploading={branding.uploading !== null}
        serverError={branding.activeUploadKind ? branding.uploadError[branding.activeUploadKind] : null}
        onClearServerError={branding.clearUploadError}
        onUpload={branding.upload}
        onClose={branding.closeUploadModal}
      />

      <BrandingPreviewModal
        open={branding.isPreviewOpen}
        onOpenChange={branding.setPreviewOpen}
        values={branding.values}
        hasLogo={hasLogo}
        hasIcon={hasIcon}
        assetVersion={branding.assetVersion}
      />

      <ConfirmActionModal
        open={branding.isDiscardOpen}
        onOpenChange={(open) => {
          if (!open && !branding.isBusy) branding.cancelDiscard();
        }}
        title={t.common.discardTitle}
        description={t.coreSettings.brandingUi.discardDescription}
        confirmLabel={t.common.discardConfirm}
        cancelLabel={t.coreSettings.brandingUi.discardKeepEditing}
        onConfirm={branding.confirmDiscard}
        loading={branding.isBusy}
      />
    </div>
  );
}
