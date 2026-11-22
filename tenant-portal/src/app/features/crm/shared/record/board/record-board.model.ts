export type BoardLaneTone = 'brand' | 'danger' | 'success';
export type BoardDropRule = 'allow' | 'confirm' | 'deny';

export interface BoardLaneSegment {
  key: string;
  count: number;
  color: string;
}

export interface BoardLane<T = unknown> {
  id: string;
  label: string;
  tone?: BoardLaneTone;
  total: number;
  items: readonly T[];
  hasNext: boolean;
  loading?: boolean;
  canCreate: boolean;
  dropRule: BoardDropRule;
  denyReason?: string;
  statusSegments?: readonly BoardLaneSegment[];
  statusSummary?: string;
}

export interface BoardMoveEvent {
  id: string;
  from: string;
  to: string;
  needsConfirm?: boolean;
}

export interface BoardLabels {
  add?: (laneLabel: string) => string;
  empty?: string;
  emptyHelp?: string;
  allShown?: string;
}
