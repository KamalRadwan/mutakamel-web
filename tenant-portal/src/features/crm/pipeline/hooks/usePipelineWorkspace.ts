import { useState, useCallback } from "react";
import { getMockBoard } from "../data/mock-pipeline-data";
import type { OpportunityBoard, OpportunityView, OpportunityCardRecord, StageFlag } from "../models/pipeline-types";

export function usePipelineWorkspace() {
  const [activeView, setActiveView] = useState<OpportunityView>("board");
  const [board, setBoard] = useState<OpportunityBoard>(getMockBoard());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Terminal move state
  const [terminalMove, setTerminalMove] = useState<{
    cardId: string;
    sourceStageId: string;
    destStageId: string;
    sourceIndex: number;
    destIndex: number;
    targetFlag: StageFlag;
    opportunity: OpportunityCardRecord | null;
  } | null>(null);

  const performMove = useCallback((cardId: string, sourceStageId: string, destStageId: string, sourceIndex: number, destIndex: number) => {
    setBoard(prev => {
      const newBoard = { ...prev };
      
      const sourceLaneIndex = newBoard.stages.findIndex(s => s.stage.id === sourceStageId);
      const destLaneIndex = newBoard.stages.findIndex(s => s.stage.id === destStageId);
      
      if (sourceLaneIndex === -1 || destLaneIndex === -1) return prev;

      const sourceItems = [...newBoard.stages[sourceLaneIndex].items];
      const destItems = sourceLaneIndex === destLaneIndex ? sourceItems : [...newBoard.stages[destLaneIndex].items];

      const [movedItem] = sourceItems.splice(sourceIndex, 1);
      
      // Update item's stage
      const updatedItem = {
        ...movedItem,
        stageId: destStageId,
        stageFlag: newBoard.stages[destLaneIndex].stage.flag,
      };

      destItems.splice(destIndex, 0, updatedItem);

      newBoard.stages[sourceLaneIndex].items = sourceItems;
      if (sourceLaneIndex !== destLaneIndex) {
        newBoard.stages[destLaneIndex].items = destItems;
      }

      // Re-calculate totals
      if (sourceLaneIndex !== destLaneIndex) {
        newBoard.stages[sourceLaneIndex].summary.totalCount = sourceItems.length;
        newBoard.stages[destLaneIndex].summary.totalCount = destItems.length;
        
        newBoard.stages[sourceLaneIndex].summary.amountsByCurrency["SAR"] = sourceItems.reduce((acc, curr) => acc + curr.amount, 0);
        newBoard.stages[destLaneIndex].summary.amountsByCurrency["SAR"] = destItems.reduce((acc, curr) => acc + curr.amount, 0);
      }

      return newBoard;
    });
  }, []);

  const moveCard = useCallback((cardId: string, sourceStageId: string, destStageId: string, sourceIndex: number, destIndex: number) => {
    const destLane = board.stages.find(s => s.stage.id === destStageId);
    if (!destLane) return;

    const targetFlag = destLane.stage.flag;
    if (targetFlag === "WON" || targetFlag === "LOST") {
      const sourceLane = board.stages.find(s => s.stage.id === sourceStageId);
      const opportunity = sourceLane?.items.find(i => i.id === cardId) || null;
      
      setTerminalMove({
        cardId, sourceStageId, destStageId, sourceIndex, destIndex, targetFlag, opportunity
      });
    } else {
      performMove(cardId, sourceStageId, destStageId, sourceIndex, destIndex);
    }
  }, [board, performMove]);

  const confirmTerminalMove = useCallback((reason: string) => {
    if (terminalMove) {
      performMove(terminalMove.cardId, terminalMove.sourceStageId, terminalMove.destStageId, terminalMove.sourceIndex, terminalMove.destIndex);
      // Here you would also update the reason/notes to the API
      setTerminalMove(null);
    }
  }, [terminalMove, performMove]);

  const cancelTerminalMove = useCallback(() => {
    setTerminalMove(null);
  }, []);

  const updateImportance = useCallback((cardId: string, newImportance: number) => {
    setBoard(prev => {
      const newBoard = { ...prev };
      for (const lane of newBoard.stages) {
        const itemIndex = lane.items.findIndex(i => i.id === cardId);
        if (itemIndex !== -1) {
          const newItems = [...lane.items];
          newItems[itemIndex] = { ...newItems[itemIndex], importance: newImportance as 0|1|2|3 };
          lane.items = newItems;
          break;
        }
      }
      return newBoard;
    });
  }, []);

  return {
    activeView,
    setActiveView,
    board,
    searchQuery,
    setSearchQuery,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
  };
}
