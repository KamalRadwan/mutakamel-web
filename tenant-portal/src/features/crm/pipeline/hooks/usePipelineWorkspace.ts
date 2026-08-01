import { useState, useCallback, useMemo, useEffect } from "react";
import { getMockBoard } from "../data/mock-pipeline-data";
import type {
  OpportunityBoard,
  OpportunityView,
  OpportunityCardRecord,
  StageFlag,
  SearchFilterToken,
} from "../models/pipeline-types";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";

export function usePipelineWorkspace() {
  const { lang, t } = useI18n();
  const isRtl = lang === "ar";

  const [activeView, setActiveView] = useState<OpportunityView>("board");
  const [board, setBoard] = useState<OpportunityBoard>(getMockBoard());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-input search state
  const [searchTokens, setSearchTokens] = useState<SearchFilterToken[]>([
    {
      id: "default-me",
      field: "sales_person",
      fieldLabel: isRtl ? t.crm.salesOfficer : "Sales Person",
      value: isRtl ? t.crm.i : "Me",
    },
  ]);

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

  // Fetch Board from Backend API with Mock Fallback
  const fetchBoardData = useCallback(async (pipelineId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const activePipelineId = pipelineId || "default";
      const res = await axiosClient.get(`/api/tenant/crm/v1/pipelines/${activePipelineId}/board`);
      if (res.data?.success && res.data?.data) {
        setBoard(res.data.data);
      }
    } catch (err: any) {
      // Fallback silently to mock board data on network/404 failure
      console.warn("Pipeline API fetch failed, utilizing mock board fallback.", err?.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoardData();
  }, [fetchBoardData]);

  const performMove = useCallback(
    async (
      cardId: string,
      sourceStageId: string,
      destStageId: string,
      sourceIndex: number,
      destIndex: number,
      terminalReason?: string
    ) => {
      // Optimistic UI Update
      setBoard((prev) => {
        const sourceLaneIndex = prev.stages.findIndex((s) => s.stage.id === sourceStageId);
        const destLaneIndex = prev.stages.findIndex((s) => s.stage.id === destStageId);

        if (sourceLaneIndex === -1 || destLaneIndex === -1) return prev;

        const newStages = prev.stages.map((lane) => ({
          ...lane,
          summary: {
            ...lane.summary,
            amountsByCurrency: { ...lane.summary.amountsByCurrency },
          },
          items: [...lane.items],
        }));

        const sourceItems = newStages[sourceLaneIndex].items;
        const destItems =
          sourceLaneIndex === destLaneIndex ? sourceItems : newStages[destLaneIndex].items;

        const [movedItem] = sourceItems.splice(sourceIndex, 1);
        if (!movedItem) return prev;

        const updatedItem = {
          ...movedItem,
          stageId: destStageId,
          stageFlag: newStages[destLaneIndex].stage.flag,
        };

        destItems.splice(destIndex, 0, updatedItem);

        if (sourceLaneIndex !== destLaneIndex) {
          newStages[sourceLaneIndex].summary.totalCount = sourceItems.length;
          newStages[destLaneIndex].summary.totalCount = destItems.length;

          newStages[sourceLaneIndex].summary.amountsByCurrency["SAR"] = sourceItems.reduce(
            (acc, curr) => acc + curr.amount,
            0
          );
          newStages[destLaneIndex].summary.amountsByCurrency["SAR"] = destItems.reduce(
            (acc, curr) => acc + curr.amount,
            0
          );
        }

        return {
          ...prev,
          stages: newStages,
        };
      });

      // API Stage Movement Mutation
      try {
        await axiosClient.post(`/api/tenant/crm/v1/opportunities/${cardId}/stage`, {
          stageId: destStageId,
          terminalReason,
        });
      } catch (err: any) {
        console.warn("Opportunity stage move API call deferred/mocked:", err?.message);
      }
    },
    []
  );

  const moveCard = useCallback(
    (
      cardId: string,
      sourceStageId: string,
      destStageId: string,
      sourceIndex: number,
      destIndex: number
    ) => {
      const destLane = board.stages.find((s) => s.stage.id === destStageId);
      if (!destLane) return;

      const targetFlag = destLane.stage.flag;
      if (targetFlag === "WON" || targetFlag === "LOST") {
        const sourceLane = board.stages.find((s) => s.stage.id === sourceStageId);
        const opportunity = sourceLane?.items.find((i) => i.id === cardId) || null;

        setTerminalMove({
          cardId,
          sourceStageId,
          destStageId,
          sourceIndex,
          destIndex,
          targetFlag,
          opportunity,
        });
      } else {
        void performMove(cardId, sourceStageId, destStageId, sourceIndex, destIndex);
      }
    },
    [board, performMove]
  );

  const confirmTerminalMove = useCallback(
    (reason: string) => {
      if (terminalMove) {
        void performMove(
          terminalMove.cardId,
          terminalMove.sourceStageId,
          terminalMove.destStageId,
          terminalMove.sourceIndex,
          terminalMove.destIndex,
          reason
        );
        setTerminalMove(null);
      }
    },
    [terminalMove, performMove]
  );

  const cancelTerminalMove = useCallback(() => {
    setTerminalMove(null);
  }, []);

  const updateImportance = useCallback(async (cardId: string, newImportance: number) => {
    setBoard((prev) => {
      const newBoard = { ...prev };
      for (const lane of newBoard.stages) {
        const itemIndex = lane.items.findIndex((i) => i.id === cardId);
        if (itemIndex !== -1) {
          const newItems = [...lane.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            importance: newImportance as 0 | 1 | 2 | 3,
          };
          lane.items = newItems;
          break;
        }
      }
      return newBoard;
    });

    try {
      await axiosClient.patch(`/api/tenant/crm/v1/opportunities/${cardId}`, {
        importance: newImportance,
      });
    } catch (err: any) {
      console.warn("Opportunity importance patch API call deferred/mocked:", err?.message);
    }
  }, []);

  // Compute a derived board that applies active searchTokens filters
  const filteredBoard = useMemo(() => {
    if (searchTokens.length === 0) return board;

    return {
      ...board,
      stages: board.stages.map((lane) => {
        const filteredItems = lane.items.filter((item) => {
          return searchTokens.every((token) => {
            const query = token.value.toLowerCase();
            switch (token.field) {
              case "opportunity":
                return item.title.toLowerCase().includes(query);
              case "sales_person":
                if (token.id === "default-me") return true;
                return item.ownerDisplayName?.toLowerCase().includes(query) || false;
              case "phone":
                return item.customerPhone?.toLowerCase().includes(query) || false;
              case "customer":
                return item.customerCompanyName?.toLowerCase().includes(query) || false;
              default:
                return true;
            }
          });
        });

        return {
          ...lane,
          items: filteredItems,
          summary: {
            ...lane.summary,
            totalCount: filteredItems.length,
          },
        };
      }),
    };
  }, [board, searchTokens]);

  return {
    activeView,
    setActiveView,
    board: filteredBoard,
    isLoading,
    error,
    searchTokens,
    setSearchTokens,
    fetchBoardData,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
  };
}
