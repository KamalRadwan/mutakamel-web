"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
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
import { EntityHistoryPanel } from "../../../components/EntityHistoryPanel";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import { TEMPLATE_READ_PERMISSION } from "../../templates-contract";
import { useTemplateDetail } from "../hooks/useTemplateDetail";
import { useTemplatePreview } from "../hooks/useTemplatePreview";
import { useTemplateRecovery } from "../hooks/useTemplateRecovery";
import { useTemplateRelease } from "../hooks/useTemplateRelease";
import { EditTemplateDrawer } from "./EditTemplateDrawer";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { TemplateRecoveryPanel } from "./TemplateRecoveryPanel";
import { TemplateReleasePanel } from "./TemplateReleasePanel";
import { TemplateVersionsPanel } from "./TemplateVersionsPanel";

/** `TemplateDefinitionEntity` is audited as `template_definition`. */
const TEMPLATE_AUDIT_ENTITY_TYPE = "template_definition";

export function TemplateDetailWorkspace({ id }: { id: string }) {
  const detail = useTemplateDetail(id);
  const { t, lang, grants, template } = detail;
  const copy = t.coreOperations.templates;
  const describeError = useCoreOperationsErrorText();
  const release = useTemplateRelease(template, grants, detail.reload);
  const preview = useTemplatePreview(template, grants.canPreview);
  const recovery = useTemplateRecovery(template, grants.canRestore, detail.reload);

  if (detail.isEntitlementBlocked) {
    return <UnavailableState backHref={TENANT_ROUTES.core} />;
  }

  return (
    <PermissionGate require={TEMPLATE_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
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
                    <Button variant="outline" size="sm" onClick={detail.openEdit}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {copy.edit}
                    </Button>
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

            {/* 7.12 — this is the definition's metadata and lifecycle, not a
                document editor. The design system has no component that can
                express `TemplateDocumentV1` (18 node types, absolute and flow
                layout, bindings, formula ASTs); `RichTextEditor` handles
                sanitized HTML for one field. Shipping a list under an editor's
                name is what MASTER-PLAN 7.12 forbids. */}
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

            <TemplateVersionsPanel
              release={release}
              canRestore={grants.canRestore && grants.canUpdate}
              canPublish={grants.canPublish}
            />

            {grants.canPreview ? (
              <TemplatePreviewPanel template={template} preview={preview} />
            ) : null}

            {grants.canRestore && grants.canUpdate ? (
              <TemplateRecoveryPanel recovery={recovery} />
            ) : null}

            <EntityHistoryPanel entityType={TEMPLATE_AUDIT_ENTITY_TYPE} entityId={template.id} />

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
      </div>
    </PermissionGate>
  );
}
