"use client";

import type { CardColor, MoveToTarget } from "@/design-system";
import {
  CrmCardMenu,
  type CrmCardMenuLabels,
} from "../../../shared/components/CrmCardMenu";

type OpportunityCardMenuLabels = CrmCardMenuLabels;

export interface OpportunityCardMenuProps {
  cardColor: CardColor | null;
  onOpen: () => void;
  onDelete?: () => void;
  onColorChange?: (next: CardColor | null) => void;
  moveTargets?: readonly MoveToTarget[];
  onMove?: (stageId: string) => void;
  labels: OpportunityCardMenuLabels;
}

export function OpportunityCardMenu(props: OpportunityCardMenuProps) {
  return <CrmCardMenu {...props} />;
}
