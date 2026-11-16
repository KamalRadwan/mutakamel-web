"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import { isTemplateFocusTarget } from "../feedback/inspector-feedback-context";
import { Archive, ArchiveRestore, Palette, Pencil, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  UnavailableState,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import { TEMPLATE_PREVIEW_PERMISSION, TEMPLATE_READ_PERMISSION } from "../../templates-contract";
import { useTemplateDetail } from "../hooks/useTemplateDetail";
import { useTemplatePreview } from "../hooks/useTemplatePreview";
import { useTemplateRecovery } from "../hooks/useTemplateRecovery";
import { useTemplateRelease } from "../hooks/useTemplateRelease";
import { useTemplateVersionAuthority, useVersionHistoryFocus } from "../hooks/useTemplateVersionAuthority";
import { EditTemplateDrawer } from "./EditTemplateDrawer";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { TemplateDetailPdfPort } from "./TemplateDetailPdfPort";
import { TemplateRecoveryPanel } from "./TemplateRecoveryPanel";
import { TemplateReleasePanel } from "./TemplateReleasePanel";
import { TemplateVersionsPanel } from "./TemplateVersionsPanel";
import { supportsTemplateDesign, templateDesignTarget } from "../../template-design-route";
import { usePublishedPreviewReturnFocus } from "../feedback/published-preview-focus";
import { useTemplateRestoreDialogFocus } from "../feedback/useTemplateRestoreDialogFocus";
import { useDraftPdfRecovery } from "../hooks/useDraftPdfRecovery";

/** `TemplateDefinitionEntity` is audited as `template_definition`. */
const TEMPLATE_AUDIT_ENTITY_TYPE = "template_definition";

export function TemplateDetailWorkspace({ id }: { id: string }) {
  const detail = useTemplateDetail(id);
  const draftPdfRecovery = useDraftPdfRecovery(id);
  const { authState, user, realtimeAuthGeneration } = useTenantAuth();
  const focusScope = useRef<HTMLDivElement>(null);
  const printPanel = useRef<HTMLDivElement>(null);
  const printReloadFocus = useRef<{ origin: Element; id: string; owner: string } | null>(null);
  const { t, lang, grants } = detail;
  const definitionId = id.toLowerCase();
  const template = detail.template?.id === definitionId ? detail.template : null;
  const copy = t.coreOperations.templates;
  const describeError = useCoreOperationsErrorText();
  const preview = useTemplatePreview(template?.outputChannel === "EMAIL" ? template : null, grants.canPreview);
  const recovery = useTemplateRecovery(template, grants.canRestore, detail.reload);
  const definitionHref = `${TENANT_ROUTES.coreTemplates}/${definitionId}`;
  const previewTarget = template?.id === definitionId ? templateDesignTarget(template.scope) : null;
  const versionAccess = useTemplateVersionAuthority(definitionId, template);
  const versionHistoryFocus = useVersionHistoryFocus(focusScope);
  const release = useTemplateRelease(template, grants, detail.reload, versionAccess.authority);
  const canOpenPublishedPreview = authState === "AUTHENTICATED" && previewTarget &&
    can(user, TEMPLATE_READ_PERMISSION, previewTarget) && can(user, TEMPLATE_PREVIEW_PERMISSION, previewTarget);
  usePublishedPreviewReturnFocus(definitionHref, realtimeAuthGeneration, focusScope,
    authState === "AUTHENTICATED" && !detail.isLoading && !detail.loadError && !detail.isMissing &&
    template?.id === definitionId);

  const owner = JSON.stringify([user?.id, realtimeAuthGeneration]);
  const snapshotFocusOwner = template && authState === "AUTHENTICATED" && grants.canRead && grants.canRestore && grants.canUpdate
    ? JSON.stringify([definitionId, owner, template.scope.type, template.scope.companyId, template.scope.branchId]) : null;
  const snapshotRestoreFocus = useTemplateRestoreDialogFocus(focusScope, snapshotFocusOwner);
  const reloadPrint = () => {
    const panel = printPanel.current;
    const origin = panel?.ownerDocument.activeElement;
    printReloadFocus.current = origin && panel?.contains(origin) ? { origin, id, owner } : null;
    detail.reload();
  };
  useLayoutEffect(() => {
    if (!detail.isLoading) return;
    const displaced = printReloadFocus.current;
    printReloadFocus.current = null;
    const target = focusScope.current;
    if (!displaced || displaced.origin.isConnected || displaced.id !== id || displaced.owner !== owner ||
      authState !== "AUTHENTICATED" || !grants.canRead || !grants.canPreview || template?.id !== id ||
      !target || !isTemplateFocusTarget(target, target)) return;
    const document = target.ownerDocument;
    const active = document.activeElement;
    if (active && active.isConnected && active !== document.body && active !== document.documentElement) return;
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    const topDialog = dialogs.at(-1);
    if (!topDialog || topDialog.contains(target)) target.focus();
  });

  return (
    <div ref={focusScope} role="region" aria-label={copy.definitionTitle} tabIndex={-1} className="flex flex-col gap-4">
      {detail.isEntitlementBlocked ? <UnavailableState backHref={TENANT_ROUTES.core} /> :
      <PermissionGate require={TEMPLATE_READ_PERMISSION}>
        {detail.isMissing ? (
          <NotFoundState
            title={copy.notFoundTitle}
            description={copy.notFoundDescription}
            backLabel={copy.backToList}
            backHref={TENANT_ROUTES.coreTemplates}
          />
        ) : detail.loadError ? (
          <ErrorState
            title={copy.detailLoadFailed}
            description={describeError(detail.loadError)}
            onRetry={detail.reload}
            retryLabel={t.common.retry}
          />
        ) : detail.isLoading || !template ? (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DetailHeader
              title={template.name}
              subtitle={template.code}
              backLabel={copy.backToList}
              backHref={TENANT_ROUTES.coreTemplates}
              breadcrumbs={[
                { label: copy.listTitle, href: TENANT_ROUTES.coreTemplates },
                { label: template.name },
              ]}
              status={
                <Badge tone={template.lifecycleStatus === "ACTIVE" ? "positive" : "neutral"}>
                  {copy.lifecycleStatuses[template.lifecycleStatus] ?? template.lifecycleStatus}
                </Badge>
              }
              secondaryActions={
                <>
                  {grants.canUpdate ? (
                    <>
                      {supportsTemplateDesign(template) ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`${TENANT_ROUTES.coreTemplates}/${template.id}/design`}>
                            <Palette className="size-4" aria-hidden="true" />
                            {t.quotationPdf.editDesign}
                          </Link>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={detail.openEdit}>
                        <Pencil className="size-4" aria-hidden="true" />
                        {copy.edit}
                      </Button>
                    </>
                  ) : null}
                  {grants.canArchive && !template.systemProtected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={detail.pendingAction === "archive"}
                        onClick={() =>
                          void detail.changeLifecycle(
                            template.lifecycleStatus === "ACTIVE" ? "archive" : "restore",
                          )
                        }
                      >
                        {template.lifecycleStatus === "ACTIVE" ? (
                          <Archive className="size-4" aria-hidden="true" />
                        ) : (
                          <ArchiveRestore className="size-4" aria-hidden="true" />
                        )}
                        {template.lifecycleStatus === "ACTIVE" ? copy.archive : copy.restore}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={detail.pendingAction === "delete"}
                        onClick={() => void detail.remove()}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                        {t.common.delete}
                      </Button>
                    </>
                  ) : null}
                </>
              }
            />

            <DetailSection
              title={copy.definitionTitle}
              description={copy.definitionDescription}
              emptyValueLabel={t.detail.notRecorded}
              fields={[
                { label: copy.code, value: <IdentifierText>{template.code}</IdentifierText> },
                { label: copy.name, value: template.name },
                { label: copy.description, value: template.description, wide: true },
                {
                  label: copy.documentType,
                  value: copy.documentTypes[template.documentType] ?? template.documentType,
                },
                {
                  label: copy.outputChannel,
                  value: copy.outputChannels[template.outputChannel] ?? template.outputChannel,
                },
                {
                  label: copy.layoutMode,
                  value: copy.layoutModes[template.layoutMode] ?? template.layoutMode,
                },
                { label: copy.dataSource, value: template.dataSourceKey },
                { label: copy.locale, value: copy.locales[template.locale] ?? template.locale },
                {
                  label: copy.direction,
                  value: copy.directions[template.direction] ?? template.direction,
                },
                { label: copy.scope, value: copy.scopeTypes[template.scope.type] },
                {
                  label: copy.definitionRevision,
                  value: String(template.definitionRevision),
                },
                {
                  label: copy.draftRevision,
                  value: String(template.currentDraft.revision),
                },
                { label: copy.updatedAt, value: formatDateTime(template.updatedAt, lang) },
              ]}
            />

            <TemplateReleasePanel
              template={template}
              release={release}
              canUpdate={grants.canUpdate}
              canPublish={grants.canPublish}
            />

            {versionAccess.authority ? (
              <div key={JSON.stringify([versionAccess.authority.key, release.versionsError?.status === 403])} ref={versionHistoryFocus}>
                <TemplateVersionsPanel
                  release={release}
                  focusScope={focusScope}
                  isRestoreFocusCurrent={versionAccess.authority.isCurrent}
                  currentVersionId={template.currentPublishedVersion?.versionId}
                  canRestore={grants.canRestore && grants.canUpdate}
                  canPublish={grants.canPublish}
                  designHref={canOpenPublishedPreview &&
                    template.outputChannel === "PRINT" && supportsTemplateDesign(template)
                    ? `${definitionHref}/design`
                    : undefined}
                />
              </div>
            ) : versionAccess.denied ? <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate> : (
              <div key="history-recovery" ref={versionHistoryFocus}>
                <DetailSection title={copy.versionsTitle} description={copy.versionsDescription}>
                  <DegradedBanner message={copy.versionsLoadFailed} />
                  {(versionAccess.canRetry || versionAccess.recovering) && (
                    <Button type="button" size="sm" variant="outline" loading={versionAccess.recovering}
                      onClick={() => void versionAccess.retry()}>{t.common.retry}</Button>
                  )}
                </DetailSection>
              </div>
            )}

            {grants.canPreview ? (
              template.outputChannel === "EMAIL" ? <TemplatePreviewPanel template={template} preview={preview} /> :
              <div ref={printPanel} className="contents">
                <TemplateDetailPdfPort key={template.id} template={template} canPreview={grants.canPreview}
                  reload={reloadPrint} draftPdfRecovery={draftPdfRecovery} />
              </div>
            ) : null}

            {grants.canRestore && grants.canUpdate ? (
              <TemplateRecoveryPanel recovery={recovery} restoreFocus={snapshotRestoreFocus} />
            ) : null}

            <RecordHistoryTab entityType={TEMPLATE_AUDIT_ENTITY_TYPE} entityId={template.id} />

            <EditTemplateDrawer
              key={template.etag}
              template={template}
              isOpen={detail.isEditOpen}
              onClose={detail.closeEdit}
              onSubmit={detail.saveMetadata}
              isSubmitting={detail.isSubmitting}
              error={detail.formError}
            />

            <ConflictDialog
              open={detail.hasConflict}
              onOpenChange={(open) => {
                if (!open) detail.dismissConflict();
              }}
              title={copy.conflictTitle}
              description={copy.conflictDescription}
              onReload={detail.resolveConflict}
              onCancel={detail.dismissConflict}
              labels={{
                yourChanges: copy.conflictYours,
                theirChanges: copy.conflictTheirs,
                reload: copy.conflictReload,
                overwrite: copy.conflictOverwrite,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </PermissionGate>}
    </div>
  );
}
