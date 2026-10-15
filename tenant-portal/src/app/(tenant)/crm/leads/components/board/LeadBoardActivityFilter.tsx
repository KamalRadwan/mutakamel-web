"use client";

import {
  ColumnSegmentBar,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  type BoardColumnSegment,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";

// The same `-vivid` fills the segment bar above draws, so a dot names the
// slice it filters to.
const SEGMENT_DOT: Record<BoardColumnSegment["tone"], string> = {
  negative: "bg-destructive-vivid",
  caution: "bg-warning-vivid",
  positive: "bg-success-vivid",
  neutral: "bg-border",
};

interface LeadBoardActivityFilterProps {
  stageLabel: string;
  segments: BoardColumnSegment[];
  /** The selected bucket's segment id — a `LeadActivityState` — or null for the whole column. */
  value: string | null;
  onChange: (next: string | null) => void;
}

/**
 * The column's activity distribution, and a filter on it. Only buckets that
 * hold a card are offered, plus the selected one so it can always be cleared;
 * pressing the selected bucket again shows the whole column.
 */
export function LeadBoardActivityFilter({ stageLabel, segments, value, onChange }: LeadBoardActivityFilterProps) {
  const { t } = useI18n();
  const offered = segments.filter((segment) => segment.value > 0 || segment.id === value);
  if (offered.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <ColumnSegmentBar segments={segments} label={t.crmLeads.card.activityBar} />
      <ToggleGroup
        type="single"
        size="xs"
        value={value ?? ""}
        onValueChange={(next) => onChange(next || null)}
        aria-label={formatTemplate(t.crmLeadBoard.activityFilter, { stage: stageLabel })}
        className="flex-wrap bg-transparent p-0"
      >
        {offered.map((segment) => {
          const label = formatTemplate(t.crmLeadBoard.activityFilterItem, {
            state: segment.label,
            count: segment.value,
          });
          return (
            <ToggleGroupItem key={segment.id} value={segment.id} aria-label={label} title={label}>
              <span className={cn("size-2 rounded-full", SEGMENT_DOT[segment.tone])} aria-hidden="true" />
              <span className="tabular-nums">{segment.value}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
