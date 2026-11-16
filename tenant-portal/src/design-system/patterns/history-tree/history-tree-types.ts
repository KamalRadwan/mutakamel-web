import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Outcome tone for the history rail marker. */
export type HistoryTone = "positive" | "negative" | "neutral";

/** Single field-level transition rendered inside Level 3 (`HistoryDiffList`). */
export interface HistoryDiffRow {
  key: string;
  /** Localized field name (optionally prefixed with subject label). */
  label: ReactNode;
  /** Previous value. Strings automatically receive accessible struck-through styling. */
  before?: ReactNode;
  /** New/current value. Strings automatically receive foreground styling. */
  after?: ReactNode;
  /** Defaults to `true` (`before > after`). Set `false` for one-sided snapshot rows. */
  showTransition?: boolean;
}

/** Canonical 3-level History node (`Actor - Date` -> `Action + #Ref` -> `Details of changes`). */
export interface HistoryTreeNode {
  id: string;
  /** Level 1: Actor display name. Omit when only timestamp applies. */
  actorName?: ReactNode;
  /** Level 1: Initials displayed inside the actor avatar. */
  actorInitials?: string;
  /** Level 1: Already-formatted timestamp string or `<DateTime />` element. */
  timestamp: ReactNode;
  /** Level 1: Outcome tone for the timeline marker dot. */
  tone?: HistoryTone;
  /** Level 1: Optional explicit icon inside the timeline marker dot. */
  markerIcon?: LucideIcon;
  /** Level 2: Localized domain action headline (e.g. `Create Lead`, `Add Quotation`). */
  actionTitle: ReactNode;
  /** Level 2: Optional icon rendered inside the action chip. */
  actionIcon?: LucideIcon;
  /** Level 2: Optional `#Reference` code rendered inside `<IdentifierText>`. */
  referenceLabel?: string | null;
  /** Level 2: Optional authorized route link for the reference badge. */
  referenceHref?: string | null;
  /** Level 2: Optional trailing badges (e.g. revision status pills). */
  badges?: ReactNode;
  /** Level 3: Optional count badge next to the collapsible trigger (e.g. `3 changes`). */
  changeCountLabel?: string | null;
  /** Level 3: Structured field changes rendered via `HistoryDiffList`. */
  diffs?: HistoryDiffRow[];
  /** Level 3: Optional footer line below the diff rows (e.g. audit reason). */
  detailsFooter?: ReactNode;
  /** Level 3: Custom body override when not using structured `diffs`. */
  details?: ReactNode;
}

export interface HistoryFilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface HistoryTreeProps {
  items: HistoryTreeNode[];
  /** Accessible `<ol>` label. */
  label: string;
  /** Localized trigger label for Level 3 (`Details of changes`). */
  detailsLabel: string;
  /** Localized fallback message when an item has zero field-level diffs. */
  emptyDetailsLabel?: string;
  openIds: ReadonlySet<string>;
  onToggleItem: (id: string, open: boolean) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onLoadMore?: () => void;
  loadMoreLabel?: string;
  isLoadingMore?: boolean;
  density?: "standard" | "compact";
  className?: string;
}

export interface HistorySectionProps<TFilter extends string = string> {
  /** Card header title (e.g. `History` / `Revisions`). */
  title: string;
  description?: string;
  items: HistoryTreeNode[];
  /** Localized trigger label for Level 3 (`Details of changes`). */
  detailsLabel: string;
  /** Localized fallback message when an item has zero field-level diffs. */
  emptyDetailsLabel?: string;
  expandAllLabel: string;
  collapseAllLabel: string;
  density?: "standard" | "compact";
  /** Optional category filter pills rendered at the top of the card. */
  filters?: readonly HistoryFilterOption<TFilter>[];
  filterLabel?: string;
  selectedFilter?: TFilter;
  onFilterChange?: (value: TFilter) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Initial load error title; renders `<ErrorState>` when provided. */
  errorTitle?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  onLoadMore?: () => void;
  loadMoreLabel?: string;
  isLoadingMore?: boolean;
  /** Pagination load-more error title; renders an inline `<ErrorState>` below the tree. */
  loadMoreErrorTitle?: string | null;
  onRetryLoadMore?: () => void;
  className?: string;
}
