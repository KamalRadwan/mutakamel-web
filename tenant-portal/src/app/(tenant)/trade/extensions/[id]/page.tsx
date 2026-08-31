"use client";

import { use } from "react";
import { CheckCircle2, Save, Send } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { EXTENSION_READ_PERMISSION } from "../extension-contract";
import { ExtensionFieldRows } from "../components/ExtensionFieldRows";
import { useExtensionProfile } from "./hooks/useExtensionProfile";

export default function ExtensionProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const {
    lang,
    canRead,
    canManage,
    canPublish,
    profile,
    versions,
    versionsUnavailable,
    fields,
    setFields,
    isLoading,
    queryError,
    isNotFound,
    pending,
    formError,
    saveFields,
    validate,
    publish,
    reload,
  } = useExtensionProfile(id);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={profile?.code ?? t.tradeAutomation.profileDetailTitle}
        subtitle={profile ? tradeStatusLabel(t.tradeStatus, profile.targetCode) : undefined}
        status={
          profile ? (
            <Badge tone={profile.status === "ACTIVE" ? "positive" : "neutral"}>
              {tradeStatusLabel(t.tradeStatus, profile.status)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeAutomation.backToProfiles}
        backHref={TENANT_ROUTES.tradeExtensions}
        secondaryActions={
          profile ? (
            <>
              <Button
                variant="outline"
                disabled={!canManage || pending !== null}
                loading={pending === "save"}
                onClick={() => void saveFields()}
              >
                <Save className="size-4" aria-hidden="true" />
                {t.tradeAutomation.saveFields}
              </Button>
              <Button
                variant="outline"
                disabled={!canManage || pending !== null}
                loading={pending === "validate"}
                onClick={() => void validate()}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t.tradeGovernance.validate}
              </Button>
              <Button
                variant="outline"
                disabled={!canPublish || pending !== null}
                loading={pending === "publish"}
                onClick={() => void publish()}
              >
                <Send className="size-4" aria-hidden="true" />
                {t.tradeCommon.publish}
              </Button>
            </>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeAutomation.profileNotFound}
          description={t.tradeAutomation.profileNotFoundDescription}
          backLabel={t.tradeAutomation.backToProfiles}
          backHref={TENANT_ROUTES.tradeExtensions}
        />
      ) : isLoading ? (
        <Skeleton className="h-80" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeAutomation.profileLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : profile ? (
        <>
          {formError ? <DegradedBanner message={formError} /> : null}
          {versionsUnavailable ? (
            <DegradedBanner message={t.tradeAutomation.versionsUnavailable} />
          ) : null}

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeGovernance.scopeTarget,
                value: tradeStatusLabel(t.tradeStatus, profile.scopeTarget),
              },
              { label: t.tradeCommon.version, value: String(profile.version) },
              {
                label: t.tradeAutomation.publishedVersion,
                value: profile.currentPublishedVersion
                  ? `v${profile.currentPublishedVersion.versionNumber}`
                  : null,
              },
              {
                label: t.tradeAutomation.draftVersion,
                value: profile.editableDraftVersion
                  ? `v${profile.editableDraftVersion.versionNumber}`
                  : null,
              },
              {
                label: t.tradeCommon.updatedAt,
                value: formatDateTime(profile.updatedAt, lang),
              },
            ]}
          />

          <DetailSection
            title={t.tradeAutomation.fields}
            description={t.tradeAutomation.fieldsReplaceHint}
          >
            <ExtensionFieldRows
              fields={fields}
              onChange={setFields}
              disabled={!canManage || pending !== null}
            />
          </DetailSection>

          <DetailSection title={t.tradeAutomation.versionHistory}>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tradeGovernance.noVersions}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center gap-2 text-sm">
                    <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                      {tradeStatusLabel(t.tradeStatus, version.status)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatDateTime(version.updatedAt, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={EXTENSION_READ_PERMISSION}>{content}</PermissionGate>
  );
}
