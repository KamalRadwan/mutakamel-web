import { projectTemplateFixedTableGeometry, type TemplateFixedTableGeometryV1, type TemplateNodeV1 } from "@mutakamel/template-schema/browser-safe";

type StaticTableNode = Extract<TemplateNodeV1, { type: "staticTable" }>;

export function fixedLiteralGrid(node: TemplateNodeV1 | undefined) {
  if (node?.type !== "staticTable" || !node.props.fixedCanvas || node.layout.kind !== "ABSOLUTE" ||
    node.props.rows.some(row => row.cells.some(cell => cell.value.kind !== "TEXT"))) return null;
  try {
    return { node, grid: projectTemplateFixedTableGeometry(node) };
  } catch {
    return null;
  }
}

export function FixedStaticTableGrid({ node, grid }: { node: StaticTableNode; grid: TemplateFixedTableGeometryV1 }) {
  const cellText = new Map(node.props.rows.flatMap(row => row.cells.map(cell => [cell.id, cell.value.kind === "TEXT" ? cell.value.value : ""] as const)));
  return <span className="relative block size-full overflow-hidden" aria-hidden="true">
    {grid.cells.map(cell => <span key={cell.cellId} className="absolute box-border ring-1 ring-inset ring-border" style={{
      insetInlineStart: `${grid.innerInlineStartMm + cell.inlineStartMm}mm`, insetBlockStart: `${grid.innerBlockStartMm + cell.blockStartMm}mm`,
      inlineSize: `${cell.widthMm}mm`, blockSize: `${cell.heightMm}mm`,
    }}>
      <span className={cell.wrap ? "absolute overflow-hidden whitespace-normal break-words" : "absolute overflow-hidden whitespace-nowrap"} style={{
        insetInlineStart: `${cell.insetsMm.inlineStart}mm`, insetBlockStart: `${cell.insetsMm.blockStart}mm`,
        inlineSize: `${cell.contentWidthMm}mm`, blockSize: `${cell.contentHeightMm}mm`,
      }}>{cellText.get(cell.cellId)}</span>
    </span>)}
  </span>;
}
