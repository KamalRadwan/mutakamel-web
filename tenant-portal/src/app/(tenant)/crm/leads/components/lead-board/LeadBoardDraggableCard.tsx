"use client";

import { Draggable } from "@hello-pangea/dnd";
import { localizedName } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import type { LeadCardMoveTarget } from "../lead-card/LeadCardMenu";
import type { useLeadBoard } from "./useLeadBoard";
import { LeadBoardCard } from "./LeadBoardCard";
import { LeadBoardExpandedCard } from "./LeadBoardExpandedCard";

type Board = ReturnType<typeof useLeadBoard>;

export function LeadBoardDraggableCard({ lead, stage, index, board }: {
  lead: LeadItem; stage: LeadStage; index: number; board: Board;
}) {
  const { lang, editingLeadId, canUpdate, canDelete, nonTerminalStages, isMovePending,
    sources, canOpenActivities, setEditingLeadId, onOpenLead, onOpenQuickModal,
    onOpenActivities, onDeleteLead, onMoveStage, onCardChange,
    draggingFromStage, draggingToStage } = board;
  const isTerminal = stage.flag === "CONVERTED";
  const isCardExpanded = editingLeadId === lead.id;
  const canEditLead = canUpdate(lead) && !isTerminal;
  const moveTargets: LeadCardMoveTarget[] = nonTerminalStages
    .filter((s) => s.id !== lead.stageId)
    .map((s) => ({ id: s.id, label: localizedName(s, lang) }));

  return (
    <Draggable
      key={lead.id}
      draggableId={lead.id}
      index={index}
      isDragDisabled={isMovePending || !canEditLead || isCardExpanded}
    >
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
        >
          {isCardExpanded ? (
            <LeadBoardExpandedCard
              lead={lead}
              stage={stage}
              sources={sources}
              canUpdate={canEditLead}
              canDelete={canDelete(lead)}
              moveTargets={moveTargets}
              showActivityEntry={canOpenActivities}
              onCollapse={() => setEditingLeadId(null)}
              onOpenLead={() => onOpenLead(lead)}
              onOpenQuickModal={() => onOpenQuickModal(lead)}
              onOpenActivities={() => onOpenActivities(lead)}
              onDelete={() => onDeleteLead(lead)}
              onMoveStage={(targetStageId) =>
                onMoveStage(lead.id, targetStageId, lead)
              }
              onCardChange={(patch) => onCardChange(lead.id, patch, lead)}
            />
          ) : (
            <LeadBoardCard
              lead={lead}
              stage={stage}
              isDragging={dragSnapshot.isDragging}
              draggingFromLabel={
                draggingFromStage ? localizedName(draggingFromStage, lang) : ""
              }
              draggingToLabel={
                draggingToStage ? localizedName(draggingToStage, lang) : ""
              }
              canUpdate={canEditLead}
              canDelete={canDelete(lead)}
              moveTargets={moveTargets}
              showActivityEntry={canOpenActivities}
              onOpenLead={() => onOpenLead(lead)}
              onExpandView={() => setEditingLeadId(lead.id)}
              onOpenQuickModal={() => onOpenQuickModal(lead)}
              onOpenActivities={() => onOpenActivities(lead)}
              onDelete={() => onDeleteLead(lead)}
              onMoveStage={(targetStageId) =>
                onMoveStage(lead.id, targetStageId, lead)
              }
              onCardChange={(patch) => onCardChange(lead.id, patch, lead)}
            />
          )}
        </div>
      )}
    </Draggable>
  );
}
