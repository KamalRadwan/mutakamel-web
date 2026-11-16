"use client";
import { ChartFrame } from "./chart-common";
export interface HeatmapCell { key: string; label: string; value: number | null; formatted: string; description?: string; onSelect?: () => void }
export function MatrixHeatmapChart({ columns, rows, cells, label, summary, lowLabel, highLabel, emptyLabel, rowEvidence }: { columns: string[]; rows: string[]; cells: Array<Array<HeatmapCell | null>>; label: string; summary: string; lowLabel: string; highLabel: string; emptyLabel: string; rowEvidence?: { label: string; values: string[]; position?: "end" } }) {
  const all = cells.flatMap((row) => row.flatMap((cell) => cell?.value == null ? [] : [cell.value]));
  const max = Math.max(0, ...all); const min = Math.min(0, ...all);
  const evidenceAtEnd = rowEvidence?.position === "end";
  const evidenceHeader = rowEvidence && <span className="text-center text-muted-foreground">{rowEvidence.label}</span>;
  const evidenceCell = (rowIndex: number) => rowEvidence ? [<span key={`evidence:${rowIndex}`} className="flex items-center justify-center rounded-sm bg-muted text-center tabular-nums">{rowEvidence.values[rowIndex] ?? emptyLabel}</span>] : [];
  return <div className="space-y-2"><ChartFrame label={label} summary={summary} height={Math.min(380, 52 + rows.length * 38)} interactive={cells.some((row) => row.some((cell) => cell?.onSelect))}>
    <div className="h-full overflow-auto"><div className="grid gap-1 text-2xs" style={{ gridTemplateColumns: `6rem ${rowEvidence && !evidenceAtEnd ? "6rem " : ""}repeat(${columns.length}, minmax(3.5rem, 1fr))${evidenceAtEnd ? " 6rem" : ""}`, minWidth: `${96 + (rowEvidence ? 96 : 0) + columns.length * 60}px` }}>
      <span />{!evidenceAtEnd && evidenceHeader}{columns.map((column, index) => <bdi key={index} className="truncate text-center text-muted-foreground" title={column}>{column}</bdi>)}{evidenceAtEnd && evidenceHeader}
      {rows.flatMap((row, rowIndex) => [<span key={`label:${rowIndex}`} className="flex items-center truncate text-muted-foreground" title={row}>{row}</span>,
        ...(!evidenceAtEnd ? evidenceCell(rowIndex) : []),
        ...columns.map((_, columnIndex) => { const cell = cells[rowIndex]?.[columnIndex]; const ratio = cell?.value == null ? 0 : max === min ? 0 : (cell.value - min) / (max - min);
          const strong = cell?.value != null && ratio >= .65;
          const style = cell?.value == null ? undefined : { backgroundColor: "var(--primary)", opacity: strong ? 1 : .15 + ratio * .38 };
          const missingPattern = cell?.value === null && cell.description ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, var(--border) 4px 5px)" } : undefined;
          const content = <><span className="absolute inset-0 rounded-sm" aria-hidden="true" style={style ?? missingPattern} /><span className={strong ? "relative text-primary-foreground tabular-nums" : "relative tabular-nums"}>{cell?.formatted ?? emptyLabel}</span>{cell?.description && <span className="sr-only">{cell.description}</span>}</>;
          const classes = "relative flex min-h-8 items-center justify-center rounded-sm border border-border bg-muted px-1 text-foreground";
          const title = cell ? `${cell.label}: ${cell.formatted}${cell.description ? ` · ${cell.description}` : ""}` : emptyLabel;
          return cell?.onSelect ? <button key={columnIndex} type="button" className={`${classes} focus-visible:outline-2 focus-visible:outline-ring`} aria-label={`${cell.label}: ${cell.formatted}`} title={`${cell.label}: ${cell.formatted}`} onClick={cell.onSelect}>{content}</button>
            : <div key={columnIndex} className={classes} title={title}>{content}</div>;
        }), ...(evidenceAtEnd ? evidenceCell(rowIndex) : [])])}
    </div></div>
  </ChartFrame><p className="flex justify-between gap-2 text-2xs text-muted-foreground"><span>{lowLabel}</span><span>{highLabel}</span></p></div>;
}
