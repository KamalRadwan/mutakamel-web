"use client";
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useDataCopy, useDataInput, useDataInteger, useFieldSearch } from "./hooks/useDataControls";
import type { DataDescriptor } from "./binding-contract";
import { useDataEditingDisabled } from "./data-editing-context";

export function FieldPicker({ descriptor, value, change, rowSourcePath, formula = false, eligiblePaths, sourceReady = true }: { descriptor: DataDescriptor; value: string; change(path: string): void; rowSourcePath?: string; formula?: boolean; eligiblePaths?: readonly string[]; sourceReady?: boolean }) {
  const c = useDataCopy(), search = useFieldSearch(descriptor, rowSourcePath, formula, eligiblePaths);
  const integer = useDataInteger();
  const disabled = useDataEditingDisabled() || !sourceReady;
  return <section className="space-y-3" aria-label={c.field}>
    <p className="text-sm text-muted-foreground">{rowSourcePath ? c.row : c.root} <bdi dir="ltr">{rowSourcePath}</bdi></p>
    <Field label={c.search} showLabel><Input disabled={disabled} value={search.search} onChange={useDataInput(search.setSearch)} /></Field>
    <Field label={c.group} showLabel><Select disabled={disabled} value={search.group} onValueChange={search.setGroup}><SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="ALL">{c.all}</SelectItem>{search.groups.map(group => <SelectItem key={group} value={group}><bdi dir="ltr">{group}</bdi></SelectItem>)}</SelectContent>
    </Select></Field>
    <p className="text-sm">{c.count}: <bdi>{integer(search.count)}</bdi></p>
    <ul className="max-h-64 divide-y divide-border overflow-auto rounded-md border border-border">{search.rows.map(({ path, field }) => <li key={path} className="p-2">
      <Button disabled={disabled} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal" aria-pressed={value === path} onClick={() => change(path)}><bdi dir="ltr">{path}</bdi></Button>
      <p className="text-xs text-muted-foreground">{c.status[field.dataType as keyof typeof c.status]} · {field.dimension && c.status[field.dimension.kind as keyof typeof c.status]} {field.sensitive && c.sensitive} {(field.nullable || field.parentNullable) && c.nullable}</p>
    </li>)}</ul>
    {!search.rows.length && <p role="status" className="text-sm text-muted-foreground">{c.noFields}</p>}
    {!sourceReady && <p role="status">{c.status.unavailable}</p>}
    {value && !search.count && <p role="alert">{c.repair} <bdi dir="ltr">{value}</bdi></p>}
  </section>;
}
