"use client";

import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { configurationFieldKey, type ConfigurationDraft, type ConfigurationPath } from "../configuration-draft";
import type { ConfigurationNode } from "../configuration-input-schema";
import type { useConfigurationForm } from "../hooks/useConfigurationForm";

interface Props { node: ConfigurationNode; draft: ConfigurationDraft; path: ConfigurationPath; required: boolean; action: ReturnType<typeof useConfigurationForm>; review?: boolean }

export function ConfigurationFields({ node, draft, path, required, action, review = false }: Props) {
  const { t, lang } = useI18n();
  const copy = t.applicationConfiguration;
  const label = node.ui.label[lang], hint = node.ui.help?.[lang];
  const errorCode = action.state?.errors[configurationFieldKey(path)];
  const error = errorCode ? copy.errors[errorCode] : undefined;
  const disabled = !action.editable || review;
  if (node.type === "object" || node.type === "array") return <fieldset className="min-w-0 space-y-3 rounded-md border border-border p-3">
    <legend className="px-1 text-sm font-medium">{label}{required && <span aria-hidden="true"> *</span>}</legend>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {draft === undefined ? review ? <p className="text-sm text-muted-foreground">{copy.omitted}</p>
      : <Button variant="outline" disabled={disabled} onClick={() => action.include(path, node)}>{copy.include}</Button> : <>
      {node.type === "object" && draft.kind === "object" && Object.entries(node.properties).map(([name, child]) =>
        <ConfigurationFields key={name} node={child} draft={draft.fields[name]} path={[...path, name]} required={node.required.includes(name)} action={action} review={review} />)}
      {node.type === "array" && draft.kind === "array" && <>
        {draft.items.map((item, index) => <div key={index} className="min-w-0 space-y-2 border-s border-border ps-3">
          <p className="text-xs text-muted-foreground">{copy.item} {formatNumber(index + 1, lang)}</p>
          <ConfigurationFields node={node.items} draft={item} path={[...path, String(index)]} required action={action} review={review} />
          {!review && <Button variant="ghost" disabled={disabled} onClick={() => action.removeItem(path, index)}>{copy.removeItem}</Button>}
        </div>)}
        {!review && <Button variant="outline" disabled={disabled || draft.items.length >= node.maxItems} onClick={() => action.addItem(path, node)}>{copy.addItem}</Button>}
      </>}
      {!required && !review && <Button variant="ghost" disabled={disabled} onClick={() => action.change(path, undefined)}>{copy.omit}</Button>}
    </>}
  </fieldset>;

  const text = draft?.kind === "scalar" ? draft.text : "";
  if (review && (draft === undefined || (node.type === "string" && node.writeOnly))) return <dl className="space-y-1">
    <dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm">{draft === undefined ? copy.omitted : copy.secretProvided}</dd>
  </dl>;
  const selected = node.enum?.findIndex((value) => String(value) === text) ?? -1;
  return <div className="min-w-0 space-y-2">
    <Field label={label} hint={hint} error={error} required={required} readOnly={review}>
      {node.enum ? <Select value={draft === undefined || selected < 0 ? "" : String(selected + 1)} onValueChange={(value) => action.chooseEnum(path, node, value)} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          {node.enum.map((_, index) => <SelectItem key={index} value={String(index + 1)}>{node.ui.enumLabels![index][lang]}</SelectItem>)}
        </SelectContent>
      </Select> : node.type === "boolean" ? <Select value={draft === undefined ? "" : text} onValueChange={(value) => action.changeScalar(path, value)} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">{t.filters.yes}</SelectItem><SelectItem value="false">{t.filters.no}</SelectItem></SelectContent>
      </Select> : node.ui.widget === "textarea" ? <Textarea value={text} onChange={(event) => action.changeScalar(path, event.target.value)} disabled={!action.editable && !review} readOnly={review} />
        : <Input value={text} onChange={(event) => action.changeScalar(path, event.target.value)} type={node.type === "string" && node.writeOnly ? "password" : "text"}
          autoComplete={node.type === "string" && node.writeOnly ? "new-password" : "off"} inputMode={node.type === "number" || node.type === "integer" ? "decimal" : "text"}
          disabled={!action.editable && !review} readOnly={review} />}
    </Field>
    {!required && draft !== undefined && !review && <Button variant="ghost" disabled={disabled} onClick={() => action.change(path, undefined)}>{copy.omit}</Button>}
  </div>;
}
