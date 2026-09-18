"use client";

import type { CardColor, MoveToTarget } from "@/design-system";
import {
  CrmCardMenu,
  type CrmCardMenuLabels,
} from "../../../shared/components/CrmCardMenu";

export type CustomerProfileCardMenuLabels = CrmCardMenuLabels;

export interface CustomerProfileCardMenuProps {
  cardColor: CardColor | null;
  onOpen: () => void;
  onDelete?: () => void;
  onColorChange?: (next: CardColor | null) => void;
  moveTargets?: readonly MoveToTarget[];
  onMove?: (status: string) => void;
  labels: CustomerProfileCardMenuLabels;
}

export function CustomerProfileCardMenu(
  props: CustomerProfileCardMenuProps,
) {
  return <CrmCardMenu {...props} />;
}
