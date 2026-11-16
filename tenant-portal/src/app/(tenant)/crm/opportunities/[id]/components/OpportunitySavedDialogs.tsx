"use client";

import { ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreateTagModal } from "../../../leads/components/create-lead/CreateTagModal";
import { TerminalMoveDialog } from "../../components/TerminalMoveDialog";
import type { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";
import { PipelineTransferDialog } from "./PipelineTransferDialog";

export function OpportunitySavedDialogs({ workspace }: { workspace: ReturnType<typeof useOpportunitySavedWorkspace> }) {
  const { t, lang } = useI18n();
  const { item, guard, locked, pendingStage, currentStage, stageMove, setPendingStageId, commands, transfer } = workspace;
  if (!item) return null;
  const terminal = pendingStage?.flag === "WON" || pendingStage?.flag === "LOST" ? pendingStage : null;
  return <>
    <ConfirmActionModal open={guard.isDiscardOpen} onOpenChange={(open) => { if (!open) guard.cancelDiscard(); }} loading={locked}
      title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel} onConfirm={guard.confirmDiscard} />
    <ConfirmActionModal open={pendingStage !== null && terminal === null} onOpenChange={(open) => { if (!open) setPendingStageId(null); }} loading={stageMove.isMoving}
      title={t.crmLeadDetail.moveStageTitle} description={[formatTemplate(t.crmLeadDetail.moveStageDescription, { from: currentStage ? localizedName(currentStage, lang) : "—", to: pendingStage ? localizedName(pendingStage, lang) : "" }), stageMove.error].filter(Boolean).join(" ")}
      confirmLabel={stageMove.uncertain ? t.crmOpportunityDetail.form.reloadLatest : t.filters.yes} cancelLabel={t.common.cancel} onConfirm={() => { if (pendingStage) void stageMove.move(pendingStage.id).then((success) => { if (success) setPendingStageId(null); }); }} />
    <TerminalMoveDialog key={terminal?.id ?? "closed"} isOpen={terminal !== null} onClose={() => { setPendingStageId(null); stageMove.clearError(); }} opportunity={terminal ? item : null} targetFlag={terminal?.flag ?? "WON"} confirmLabel={stageMove.uncertain ? t.crmOpportunityDetail.form.reloadLatest : undefined} isSubmitting={stageMove.isMoving} error={terminal ? stageMove.error : null} onConfirm={async (reason) => { if (!terminal) return false; const success = await stageMove.move(terminal.id, reason); if (success) setPendingStageId(null); return success; }} />
    <ConfirmActionModal open={commands.deleteOpen} onOpenChange={commands.setDeleteOpen} loading={commands.saving} title={t.common.delete} description={item.title} confirmLabel={t.common.delete} cancelLabel={t.common.cancel} onConfirm={() => { void commands.deleteRecord(); }} />
    <PipelineTransferDialog transfer={transfer} />
    <CreateTagModal open={commands.createTagOpen} existingTags={commands.tags.items} onClose={() => commands.setCreateTagOpen(false)} onSuccess={async (created) => { commands.tags.addTag(created); await commands.toggleTag(created.id, false); commands.setCreateTagOpen(false); }} />
  </>;
}
