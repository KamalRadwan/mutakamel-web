"use client";

import { crmBoardScrollClass } from "../../shared/components/board/board-classes";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import { CustomerBoardColumn } from "./customer-board/CustomerBoardColumn";
import { CustomerBoardDropDock } from "./customer-board/CustomerBoardDropDock";
import type { CustomerExecutiveBoardViewProps } from "./customer-board/customer-board-types";
import { useCustomerBoard } from "./customer-board/useCustomerBoard";

export type { CustomerExecutiveBoardViewProps, QuickCreateCustomerDraft } from "./customer-board/customer-board-types";

export function CustomerExecutiveBoardView(props: CustomerExecutiveBoardViewProps) {
  const board = useCustomerBoard(props);
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div role="region" aria-label={board.t.crmCustomerProfiles.ui.board.customer_status_board}
        className={crmBoardScrollClass}>
        {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => <CustomerBoardColumn key={status} status={status} board={board} />)}
      </div>
      <CustomerBoardDropDock board={board} />
    </div>
  );
}
