"use client";

import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { useEffect, useState } from "react";
import type { OpportunityBoard, OpportunityCardRecord } from "../../models/pipeline-types";
import { BoardColumn } from "../board/board-column";
import { useI18n } from "@/i18n/I18nContext";

interface PipelineBoardViewProps {
  board: OpportunityBoard;
  moveCard: (cardId: string, sourceStageId: string, destStageId: string, sourceIndex: number, destIndex: number) => void;
  updateImportance: (cardId: string, importance: number) => void;
  onOpenActivitiesModal?: (item: OpportunityCardRecord) => void;
}

export function PipelineBoardView({ board, moveCard, updateImportance, onOpenActivitiesModal }: PipelineBoardViewProps) {
    const { t } = useI18n();
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveCard(draggableId, source.droppableId, destination.droppableId, source.index, destination.index);
  };

  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-100/50 dark:bg-[#040810] p-4 md:p-6 gap-4 items-start">
        <div className="w-full flex items-center justify-center text-gray-400">
          {t.crm.loadingTheBoard}</div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-100/50 dark:bg-[#040810] p-4 md:p-6 gap-4 items-start">
        {board.stages.map((lane) => (
          <BoardColumn key={lane.stage.id} lane={lane} updateImportance={updateImportance} onOpenActivitiesModal={onOpenActivitiesModal} />
        ))}
      </div>
    </DragDropContext>
  );
}
