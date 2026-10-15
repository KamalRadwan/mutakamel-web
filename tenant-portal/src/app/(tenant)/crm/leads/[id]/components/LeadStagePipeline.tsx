"use client";

import { ConfirmActionModal, ErrorState, StageBar } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { LeadStageItem } from "../../../lead-stages/lead-stage-contract";
import { LEAD_STAGE_BAR_TONE } from "../../components/lead-view-config";
import type { LeadStageMove } from "../hooks/useLeadStageMove";

/**
 * The pipeline as the board draws it, with this lead's stage marked — and
 * pressable: a stage IS the move here (`POST /leads/:id/stage`), gated by the
 * same capability and refusing the same destinations the board refuses. It is
 * also the single-pointer alternative to dragging that WCAG 2.2
 * `dragging-alternative` requires (docs/design/views.md#leads). Rendered from
 * the same `stages` the board uses, so the two cannot disagree on the order.
 */
export function LeadStagePipeline({ stageId, stages, degraded, canUpdate, stageMove }: {
  stageId: string;
  stages: LeadStageItem[];
  degraded: boolean;
  canUpdate: boolean;
  stageMove: LeadStageMove;
}) {
  const { t, lang } = useI18n();
  const nameOf = (id: string | null) => {
    const stage = stages.find((entry) => entry.id === id);
    return stage ? localizedValue(stage.nameAr, stage.nameEn, lang) : null;
  };
  const pendingName = nameOf(stageMove.pendingStageId);

  return (
    <>
      {!degraded && stages.length > 0 && (
        <StageBar
          label={t.crmLeads.stage}
          steps={stages.map((entry) => ({
            id: entry.id,
            label: localizedValue(entry.nameAr, entry.nameEn, lang),
            tone: LEAD_STAGE_BAR_TONE[entry.flag],
            // Conversion owns this stage; a move into it is a 409, so the step
            // is inert rather than absent — the pipeline still has it.
            disabled: entry.flag === "CONVERTED",
          }))}
          value={stageId}
          // No handler when the user may not move this lead: the bar stays a
          // picture rather than offering a control that answers 403.
          onChange={canUpdate ? (next) => next && stageMove.request(next) : undefined}
          disabled={stageMove.isMoving}
        />
      )}

      {/* Both stages named, because "are you sure" alone asks the user to
          remember which step they just pressed. */}
      <ConfirmActionModal
        open={pendingName !== null}
        onOpenChange={(next) => {
          if (!next) stageMove.dismiss();
        }}
        title={t.crmLeadDetail.moveStageTitle}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from: nameOf(stageId) ?? "—",
          to: pendingName ?? "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={stageMove.isMoving}
        onConfirm={stageMove.confirm}
      />

      {stageMove.error && (
        <ErrorState title={stageMove.error} onRetry={stageMove.clearError} retryLabel={t.common.dismiss} />
      )}
    </>
  );
}
