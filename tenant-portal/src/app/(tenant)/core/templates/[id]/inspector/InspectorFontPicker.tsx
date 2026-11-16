"use client";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { InspectorSelect } from "./InspectorFields";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorFontPicker({ value, inherited, onValue, copy: c }: { value: unknown; inherited?: unknown; onValue: (value: string) => void; copy: InspectorCopy }) {
  const { fonts } = useInspectorPorts(), selected = fonts.find(font => font.fontToken === (value ?? inherited));
  return <div className="space-y-2">
    <InspectorSelect label={c.font} value={value ?? "INHERIT"} disabled={!fonts.length} options={[{ value: "INHERIT", label: c.inherit }, ...fonts.map(font => ({ value: font.fontToken, label: c[font.fontToken] }))]} onValue={onValue} />
    {!fonts.length && <p role="status" className="text-xs text-muted-foreground">{c.fontUnavailable}</p>}
    {selected && <details className="text-xs text-muted-foreground"><summary>{c.fontMetadata}</summary><dl className="space-y-1 break-all"><dt>{c.fontBuild}</dt><dd>{selected.fontBuildId}</dd><dt>{c.fontChecksum}</dt><dd>{selected.installedFileChecksum}</dd></dl></details>}
  </div>;
}
