"use client";

import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export interface ActivitiesEmptyStateProps {
  /**
   * `filtered` — filters are hiding what exists: the way out is clearing them.
   * `period` — the calendar's period is empty while other periods are not.
   * `none` — there is nothing to show at all yet: the way in is creating one.
   */
  reason: "filtered" | "period" | "none";
  onClearFilters: () => void;
  /** Absent without the right to create, so the action is absent too rather than disabled. */
  onCreate?: () => void;
  /** The calendar floats its notice over the grid, which asks for one line and one action. */
  compact?: boolean;
  className?: string;
}

/** "Nothing matches" and "nothing yet" are different answers, and each offers its own way forward. */
export function ActivitiesEmptyState({ reason, onClearFilters, onCreate, compact = false, className }: ActivitiesEmptyStateProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const create = onCreate ? { label: copy.newActivity, onClick: onCreate } : undefined;

  if (reason === "filtered") {
    return (
      <EmptyState
        className={className}
        title={copy.workspace.empty.filteredTitle}
        description={compact ? undefined : copy.workspace.empty.filteredDescription}
        action={{ label: copy.workspace.filters.clear, onClick: onClearFilters }}
      />
    );
  }
  if (reason === "period") {
    return <EmptyState className={className} icon={CalendarDays} title={copy.workspace.calendar.emptyPeriod} action={create} />;
  }
  return (
    <EmptyState
      className={className}
      title={copy.workspace.empty.title}
      description={compact ? undefined : copy.workspace.empty.description}
      action={create}
    />
  );
}
