"use client";

import { crmBoardScrollClass } from "../../shared/components/board/board-classes";
import { OpportunityBoardColumn } from "./opportunity-board/OpportunityBoardColumn";
import { useOpportunityBoard } from "./opportunity-board/hooks/useOpportunityBoard";
import type { OpportunityExecutiveBoardViewProps } from "./opportunity-board/opportunity-board-types";

export type { OpportunityExecutiveBoardViewProps, QuickCreateOpportunityDraft } from "./opportunity-board/opportunity-board-types";

export function OpportunityExecutiveBoardView(props: OpportunityExecutiveBoardViewProps) {
  const board = useOpportunityBoard(props);
  return (
    <div className={crmBoardScrollClass}>
      {board.stages.map((stage) => <OpportunityBoardColumn key={stage.id} stage={stage} board={board} props={props} />)}
    </div>
  );
}
