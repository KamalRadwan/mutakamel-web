"use client";

import { Button, FormModal, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { usePipelineRowEditor } from "../hooks/usePipelineRowEditor";
import { EditPipelineModal } from "./EditPipelineModal";

interface PipelineRowEditorProps {
  pipelineId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PipelineRowEditor({ pipelineId, onClose, onSaved }: PipelineRowEditorProps) {
  const { t } = useI18n();
  const { detail, editor, blocked, close } = usePipelineRowEditor(pipelineId, onClose, onSaved);

  if (detail.pipeline) return <EditPipelineModal open onOpenChange={close}
    pipeline={detail.pipeline} isSubmitting={detail.isSaving} blocked={blocked}
    error={editor.error ?? (detail.queryError ? t.crmPipelines.loadFailedHint : undefined)}
    onReconcile={() => void editor.reconcile()} onSubmit={(input) => void editor.save(input)} />;

  return <FormModal open onOpenChange={close} title={t.crmPipelines.editTitle} size="card"
    description={t.crmPipelines.editDescription} isDirty={false} isSubmitting={false} hideSubmit
    onSubmit={() => undefined}
    labels={{ submit: t.common.save, cancel: t.common.close, close: t.common.close,
      discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
      sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid }}>
    <PermissionGate require="crm.pipelines.manage" denied={detail.queryError?.status === 403}>
      {detail.queryError ? <div className="space-y-3" role="status">
        <p className="text-sm text-foreground">{detail.notFound ? t.crmPipelines.notFoundDescription : t.crmPipelines.loadFailedHint}</p>
        {!detail.notFound && <Button variant="outline" onClick={() => void detail.reload()} disabled={detail.isLoading}>{t.common.retry}</Button>}
      </div> : <div className="space-y-3" aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>}
    </PermissionGate>
  </FormModal>;
}
