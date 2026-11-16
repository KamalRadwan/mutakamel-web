import type { EditorNode } from "../../template-editor-model";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";

const labels: Readonly<Record<string, keyof InspectorCopy>> = {
  text: "nodeText", richText: "nodeRichText", image: "nodeImage", dataField: "nodeDataField", container: "nodeContainer", group: "nodeGroup", row: "nodeRow", column: "nodeColumn", divider: "nodeDivider", spacer: "nodeSpacer", link: "nodeLink", button: "nodeButton", dynamicTable: "nodeDynamicTable", staticTable: "nodeStaticTable", formula: "nodeFormula", totals: "nodeTotals", pageBreak: "nodePageBreak", header: "nodeHeader", footer: "nodeFooter",
};
export function normalizeInspectorName(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
export function inspectorLayerLabel(node: EditorNode, index: number, copy: InspectorCopy, number: Intl.NumberFormat): string {
  const name = typeof node.name === "string" ? normalizeInspectorName(node.name) : undefined;
  return name ?? `${copy[labels[node.type] ?? "nodeElement"]} ${number.format(index + 1)}`;
}
