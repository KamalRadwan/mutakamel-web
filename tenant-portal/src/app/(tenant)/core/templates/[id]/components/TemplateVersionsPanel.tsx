"use client";

import { Archive, Eye, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  ReasonDialog,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import type { useTemplateRelease } from "../hooks/useTemplateRelease";

export function TemplateVersionsPanel({
  release,
  canRestore,
  canPublish,
}: {
  release: ReturnType<typeof useTemplateRelease>;
  canRestore: boolean;
  canPublish: boolean;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const describeError = useCoreOperationsErrorText();

  return (
    <DetailSection title={copy.versionsTitle} description={copy.versionsDescription}>
      {release.versionsError ? (
        <ErrorState
          title={copy.versionsLoadFailed}
          description={describeError(release.versionsError)}
          onRetry={release.reloadVersions}
          retryLabel={t.common.retry}
        />
      ) : release.isLoadingVersions ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : release.versions.length === 0 ? (
        <EmptyState title={copy.versionsEmpty} description={copy.versionsEmptyDescription} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {release.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              aria-busy={release.pendingVersionId === version.id}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-foreground">
                  {formatTemplate(copy.versionLabel, { number: String(version.versionNumber) })}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {version.changeNote ?? formatDateTime(version.publishedAt, lang)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={version.lifecycleStatus === "PUBLISHED" ? "positive" : "neutral"}>
                  {copy.versionStatuses[version.lifecycleStatus] ?? version.lifecycleStatus}
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`${copy.versionView}: ${version.versionNumber}`}
                  disabled={release.pendingVersionId !== null}
                  onClick={() => release.openVersion(version)}
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                </Button>
                {canRestore ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${copy.restoreToDraft}: ${version.versionNumber}`}
                    disabled={release.pendingVersionId !== null}
                    onClick={() => release.openRestore(version)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
                {canPublish && version.lifecycleStatus === "PUBLISHED" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${copy.retire}: ${version.versionNumber}`}
                    disabled={release.pendingVersionId !== null}
                    onClick={() => release.openRetire(version)}
                  >
                    <Archive className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {release.selected ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs">
          <span className="text-sm font-medium text-foreground">
            {formatTemplate(copy.versionLabel, {
              number: String(release.selected.versionNumber),
            })}
          </span>
          {release.isLoadingSelected ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <>
              <span className="text-muted-foreground">
                {formatTemplate(copy.versionPublishedAt, {
                  at: formatDateTime(release.selected.publishedAt, lang),
                })}
              </span>
              <IdentifierText className="text-muted-foreground">
                {formatTemplate(copy.versionChecksum, {
                  checksum: release.selected.templateContentChecksum,
                })}
              </IdentifierText>
              {release.selected.compilerVersion ? (
                <span className="text-muted-foreground">
                  {formatTemplate(copy.versionCompiler, {
                    compiler: release.selected.compilerVersion,
                    targets: release.selected.rendererTargets.join(", ") || "—",
                  })}
                </span>
              ) : null}
            </>
          )}
          <Button variant="ghost" size="xs" onClick={release.closeVersion}>
            {t.common.dismiss}
          </Button>
        </div>
      ) : null}

      {/* Restore-to-draft records an operator reason; it is required, not decorative. */}
      <ReasonDialog
        open={release.restoring !== null}
        onOpenChange={(open) => {
          if (!open) release.closeRestore();
        }}
        title={copy.restoreVersionTitle}
        description={copy.restoreVersionDescription}
        reasonRequired
        onConfirm={(reason) => void release.restoreVersion(reason)}
        loading={release.pendingVersionId !== null}
        labels={{
          reason: copy.restoreReason,
          reasonHint: copy.restoreReasonHint,
          confirm: copy.restoreToDraft,
          cancel: t.common.cancel,
        }}
      />

      <ConfirmActionModal
        open={release.retiring !== null}
        onOpenChange={(open) => {
          if (!open) release.closeRetire();
        }}
        title={copy.retireVersionTitle}
        description={copy.retireVersionDescription}
        confirmLabel={copy.retire}
        cancelLabel={t.common.cancel}
        onConfirm={() => void release.retireVersion()}
        loading={release.pendingVersionId !== null}
      />
    </DetailSection>
  );
}
