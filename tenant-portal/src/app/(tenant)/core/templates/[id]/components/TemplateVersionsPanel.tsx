"use client";

import Link from "next/link";
import { useRef, type RefObject } from "react";
import { Archive, Eye, LockKeyhole, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionModal,
  DataTable,
  DetailSection,
  DegradedBanner,
  EmptyState,
  ErrorState,
  PermissionGate,
  ReasonDialog,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import type { useTemplateRelease } from "../hooks/useTemplateRelease";
import type { TemplateVersion } from "../../template-lifecycle-contract";
import { TEMPLATE_READ_PERMISSION } from "../../templates-contract";
import { templateVersionHistoryCopy } from "../../template-version-history-copy";

import { isTemplateFocusTarget } from "../feedback/inspector-feedback-context";
import { focusTemplateRegionWhenIdle } from "../feedback/published-preview-focus";

type VersionRestoreOpener = { element: HTMLButtonElement; isCurrent: () => boolean };

export function restoreTemplateVersionFocus(event: Event, opener: VersionRestoreOpener | null, scope: HTMLElement | null) {
  event.preventDefault();
  if (!opener?.isCurrent() || !scope) return;
  const target = isTemplateFocusTarget(opener.element, scope) ? opener.element : scope;
  focusTemplateRegionWhenIdle(target);
}

export function TemplateVersionsPanel({
  release,
  canRestore,
  canPublish,
  designHref,
  currentVersionId,
  focusScope,
  isRestoreFocusCurrent,
}: {
  release: ReturnType<typeof useTemplateRelease>;
  canRestore: boolean;
  canPublish: boolean;
  designHref?: string;
  currentVersionId?: string;
  focusScope: RefObject<HTMLDivElement | null>;
  isRestoreFocusCurrent: () => boolean;
}) {
  const restoreOpener = useRef<VersionRestoreOpener | null>(null);
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const history = templateVersionHistoryCopy[lang];
  const describeError = useCoreOperationsErrorText();
  const { versionDetail: detail, registerVersionDetail, registerVersionHistory } = release;

  if (release.versionsError?.status === 403) {
    return (
      <DetailSection title={copy.versionsTitle} description={copy.versionsDescription}>
        <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={copy.versionsTitle} description={copy.versionsDescription}>
      {release.versionCursorWasReset ? <DegradedBanner message={copy.cursorExpired} /> : null}
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
        <DataTable<TemplateVersion>
          surface="embedded" rows={release.versions} isLoading={false} showRowNumbers={false} rowKey={version => version.id}
          labels={{
            retry: t.common.retry, errorTitle: copy.versionsLoadFailed, emptyTitle: copy.versionsEmpty,
            selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
            pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: () => "" },
          }}
          columns={[
            { id: "version", header: history.version, cell: version => formatTemplate(copy.versionLabel, { number: String(version.versionNumber) }) },
            { id: "status", header: t.common.status, cell: version => (
              <span className="flex flex-wrap gap-1">
                <Badge tone={version.lifecycleStatus === "PUBLISHED" ? "positive" : "neutral"}>
                  {copy.versionStatuses[version.lifecycleStatus] ?? version.lifecycleStatus}
                </Badge>
                {version.id === currentVersionId && version.lifecycleStatus === "PUBLISHED" && <Badge tone="positive">{history.current}</Badge>}
              </span>
            ) },
            { id: "publishedAt", header: history.publishedAt, cell: version => <time dateTime={version.publishedAt}>{formatDateTime(version.publishedAt, lang)}</time> },
            { id: "publisher", header: history.publisher, cell: version => <bdi>{version.publisherName ?? t.detail.notRecorded}</bdi> },
            { id: "changeNote", header: copy.changeNote, cell: version => <span dir="auto">{version.changeNote ?? t.detail.notRecorded}</span> },
            { id: "actions", header: t.common.actions, cell: version => (
              <span className="flex flex-wrap items-center gap-1">
                <Button
                  variant={detail?.row.id === version.id ? "secondary" : "ghost"}
                  size="sm"
                  aria-label={`${copy.versionView}: ${version.versionNumber}`}
                  aria-expanded={detail?.row.id === version.id}
                  aria-controls={detail?.row.id === version.id ? release.versionDetailId : undefined}
                  disabled={!release.canOpenVersion || release.pendingVersionId !== null}
                  onClick={event => void release.openVersion(version, event.currentTarget)}
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                </Button>
                {designHref && version.lifecycleStatus === "PUBLISHED" ? (
                  <Button asChild variant="outline" size="xs">
                    <Link href={`${designHref}?previewVersion=${version.id}`}
                      aria-label={`${t.quotationPdf.preview} v${version.versionNumber}`}>
                      {t.quotationPdf.preview}
                    </Link>
                  </Button>
                ) : null}
                {canRestore ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${copy.restoreToDraft}: ${version.versionNumber}`}
                    disabled={release.pendingVersionId !== null}
                    onClick={event => {
                      restoreOpener.current = { element: event.currentTarget, isCurrent: isRestoreFocusCurrent };
                      release.openRestore(version);
                    }}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
                {canPublish && version.lifecycleStatus === "PUBLISHED" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${copy.retire}: ${version.versionNumber}`}
                    disabled={release.pendingVersionId !== null || version.id === currentVersionId}
                    title={version.id === currentVersionId ? t.coreOperations.errors["CORE.TEMPLATE.VERSION.RETIRE_CURRENT"] : undefined}
                    onClick={() => release.openRetire(version)}
                  >
                    <Archive className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </span>
            ) },
          ]}
        />
      )}

      <nav ref={registerVersionHistory} tabIndex={-1} aria-label={copy.versionsTitle} className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={release.previousVersionPage}
          disabled={!release.hasPreviousVersionPage || release.isLoadingVersions || release.pendingVersionId !== null}
        >
          {t.common.previousPage}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={release.nextVersionPage}
          disabled={!release.hasNextVersionPage || release.isLoadingVersions || release.pendingVersionId !== null}
        >
          {t.common.nextPage}
        </Button>
      </nav>

      {detail && (
        <div id={release.versionDetailId} ref={registerVersionDetail} tabIndex={-1} role="region"
          aria-labelledby={`${release.versionDetailId}-title`}>
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {detail.state === "ready" && <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />}
                <CardTitle id={`${release.versionDetailId}-title`}>
                  {formatTemplate(copy.versionLabel, { number: String(detail.state === "ready" ? detail.version.versionNumber : detail.row.versionNumber) })}
                </CardTitle>
                {detail.state === "ready" && <Badge tone="neutral">{history.readOnly}</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={release.closeVersion}>{t.common.dismiss}</Button>
            </CardHeader>
            <CardContent>
              {detail.state === "pending" ? (
                <div role="status" aria-busy="true">
                  <span className="sr-only">{t.common.loading}</span>
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : detail.state === "failed" ? (
                detail.error.status === 403
                  ? <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>
                  : <ErrorState title={copy.versionsLoadFailed} description={describeError(detail.error)}
                      onRetry={() => void release.openVersion(detail.row)} retryLabel={t.common.retry} />
              ) : (
                <div className="space-y-3">
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted-foreground">{history.publishedAt}</dt>
                      <dd><time dateTime={detail.version.publishedAt}>{formatDateTime(detail.version.publishedAt, lang)}</time></dd></div>
                    <div><dt className="text-muted-foreground">{history.publisher}</dt>
                      <dd><bdi>{detail.version.publisherName ?? t.detail.notRecorded}</bdi></dd></div>
                    <div><dt className="text-muted-foreground">{history.targets}</dt>
                      <dd className="flex flex-wrap gap-1">
                        {detail.version.rendererTargets.length ? detail.version.rendererTargets.map(target =>
                          <Badge key={target} tone="neutral"><bdi>{target}</bdi></Badge>) : t.detail.notRecorded}
                      </dd></div>
                  </dl>
                  <p className="break-all text-sm text-muted-foreground">
                    {formatTemplate(copy.versionChecksum, { checksum: detail.version.templateContentChecksum })}
                  </p>
                  {detail.version.compilerVersion && <p className="text-sm text-muted-foreground">
                    {formatTemplate(copy.versionCompiler, {
                      compiler: detail.version.compilerVersion, targets: detail.version.rendererTargets.join(", ") || t.detail.notRecorded,
                    })}
                  </p>}
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{history.immutable}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Restore-to-draft records an operator reason; it is required, not decorative. */}
      <ReasonDialog
        open={release.restoring !== null}
        onOpenChange={(open) => {
          if (!open) release.closeRestore();
        }}
        onCloseAutoFocus={event => {
          const opener = restoreOpener.current;
          restoreOpener.current = null;
          restoreTemplateVersionFocus(event, opener, focusScope.current);
        }}
        title={copy.restoreVersionTitle}
        description={copy.restoreVersionDescription}
        reasonRequired
        onConfirm={(reason) => void release.restoreVersion(reason)}
        loading={release.pendingVersionId !== null}
        keepFocusWhileLoading
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
