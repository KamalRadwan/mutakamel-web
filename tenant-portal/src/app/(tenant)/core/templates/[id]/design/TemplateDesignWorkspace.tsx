"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import { Button, ErrorState, NotFoundState, PermissionGate, Skeleton, UnavailableState } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { supportsTemplateDesign, templateDesignTarget } from "../../template-design-route";
import { TEMPLATE_PREVIEW_PERMISSION, TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION } from "../../templates-contract";
import { LazyTemplateDesignEditor } from "./LazyTemplateDesignEditor";
import { PublishedTemplatePreview } from "./PublishedTemplatePreview";
import { useTemplateDesignDefinition } from "./useTemplateDesignDefinition";
import { useDraftPdfRecovery, type DraftPdfRecovery } from "../hooks/useDraftPdfRecovery";
import { discardSalesDraftTypingRollover, salesDraftEditorOwnerKey } from "../hooks/sales-draft-typing-storage";

const authoringPermissions = [TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION];
const publishedPreviewPermissions = [TEMPLATE_READ_PERMISSION, TEMPLATE_PREVIEW_PERMISSION];

export function TemplateDesignWorkspace({ id, previewVersionId }: { id: string; previewVersionId?: string }) {
  const { user, isAuthenticated, isLoading, realtimeAuthGeneration } = useTenantAuth();
  const access = useAccessMode();
  const draftPdfRecovery = useDraftPdfRecovery(JSON.stringify([id, previewVersionId]));
  const discardTyping = Boolean(previewVersionId) || (!isLoading && isAuthenticated &&
    (!authoringPermissions.every(permission => user?.permissions.includes(permission)) ||
      (access.isResolved && (!access.canRead || !access.canMutate))));
  useLayoutEffect(() => {
    if (discardTyping) discardSalesDraftTypingRollover();
  }, [discardTyping]);
  if (isLoading) return <Skeleton className="h-32 w-full" aria-busy="true" />;
  if (!access.canRead) return <UnavailableState backHref={TENANT_ROUTES.coreTemplates} />;
  const permissions = previewVersionId ? publishedPreviewPermissions : authoringPermissions;
  const scopeKey = JSON.stringify([id, realtimeAuthGeneration, user?.id, ...permissions.map(permission =>
    [permission, user?.permissionScopes[permission]])]);
  return (
    <PermissionGate require={permissions} denied={!isAuthenticated}>
      <TemplateDesignDefinition key={scopeKey} id={id} canMutate={access.canMutate}
        previewVersionId={previewVersionId} draftPdfRecovery={draftPdfRecovery} />
    </PermissionGate>
  );
}

function TemplateDesignDefinition({ id, canMutate, previewVersionId, draftPdfRecovery }: {
  id: string; canMutate: boolean; previewVersionId?: string; draftPdfRecovery: DraftPdfRecovery;
}) {
  const { result, retry, draftRefresh } = useTemplateDesignDefinition(id);
  const { user, authState, realtimeAuthGeneration } = useTenantAuth();
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const permissions = previewVersionId ? publishedPreviewPermissions : authoringPermissions;
  const target = result.state === "ready" ? templateDesignTarget(result.template.scope) : null;
  const allowed = !!target && permissions.every(permission => can(user, permission, target));
  useLayoutEffect(() => {
    // A stale profile cannot decide whether the fresh editor owns the recovery.
    if (authState !== "AUTHENTICATED") return;
    if (result.state === "ready" && allowed) {
      discardSalesDraftTypingRollover(salesDraftEditorOwnerKey(result.template, authState, user?.id, realtimeAuthGeneration, true));
    } else if (result.state === "ready" || result.state === "denied" || result.state === "missing" ||
      result.state === "unavailable") {
      discardSalesDraftTypingRollover();
    }
  }, [result, allowed, authState, user?.id, realtimeAuthGeneration]);
  if (result.state === "loading") return <Skeleton className="h-32 w-full" aria-busy="true" />;
  if (result.state === "unavailable") return <UnavailableState backHref={TENANT_ROUTES.coreTemplates} />;
  if (result.state === "missing") return <NotFoundState title={copy.notFoundTitle} description={copy.notFoundDescription}
    backLabel={copy.backToList} backHref={TENANT_ROUTES.coreTemplates} />;
  if (result.state === "denied") return <PermissionGate require={permissions} denied>{null}</PermissionGate>;
  if (result.state !== "ready") return <ErrorState title={copy.detailLoadFailed} onRetry={retry} retryLabel={t.common.retry} />;

  const { template } = result;
  if (!target || !allowed) {
    return <PermissionGate require={permissions} denied>{null}</PermissionGate>;
  }
  const backHref = `${TENANT_ROUTES.coreTemplates}/${template.id}`;
  if (!supportsTemplateDesign(template)) return <>
    <p role="status">{t.quotationPdf.editorUnsupported}</p>
    <Button asChild variant="outline"><Link href={backHref}>{copy.definitionTitle}</Link></Button>
  </>;
  const canPreview = can(user, TEMPLATE_PREVIEW_PERMISSION, target);
  if (previewVersionId) {
    if (template.outputChannel !== "PRINT") {
      return <PermissionGate require={publishedPreviewPermissions} denied>{null}</PermissionGate>;
    }
    const canEdit = canMutate && can(user, TEMPLATE_UPDATE_PERMISSION, target);
    return <PublishedTemplatePreview key={previewVersionId} template={template} versionId={previewVersionId}
      backHref={canEdit ? `${backHref}/design` : backHref} backToDesign={canEdit} />;
  }
  return <LazyTemplateDesignEditor template={template} canMutate={canMutate} backHref={backHref}
    canPreview={canPreview} draftRefresh={draftRefresh} draftPdfRecovery={draftPdfRecovery} />;
}
