"use client";

import { Button, Input, Textarea } from "@/design-system";
import type { RichTextCopy } from "@/i18n/template-rich-text-copy";
import { removeInline } from "./rich-text-adapter";
import type { RichInline, RunAddress, BindingChoice } from "./rich-text-contract";
import type { RichTextEditorController } from "./hooks/useRichTextEditor";

export function RichTextRun({ inline, address, editor, copy, bindings }: {
  inline: RichInline; address: RunAddress; editor: RichTextEditorController; copy: RichTextCopy; bindings: readonly BindingChoice[];
}) {
  const marks = inline.type === "hardBreak" ? [] : inline.marks ?? [];
  const link = marks.find(mark => mark.type === "link");
  const field = editor.linkField(address, link?.attrs.source === "LITERAL" ? link.attrs.href : "");
  const label = inline.type === "variable" ? bindings.find(choice => JSON.stringify(choice.binding) === JSON.stringify(inline.attrs.binding))?.label ?? inline.attrs.binding.path : copy.text;
  return <div className="space-y-2 rounded-md border border-border p-3">
    {inline.type === "text" && <Textarea aria-label={copy.text} dir="auto" value={inline.text} disabled={editor.hasPendingLinks} onChange={event => editor.text(address, event.currentTarget.value)}
      onSelect={event => editor.select(event, address)} onPaste={event => editor.paste(event, address)} onBlur={editor.finishGesture} onCompositionStart={editor.compositionStart} onCompositionEnd={editor.compositionEnd} />}
    {inline.type === "variable" && <p className="text-body text-foreground"><span>{copy.variable}: </span><bdi>{label}</bdi></p>}
    {inline.type === "hardBreak" && <p className="text-body text-muted-foreground">{copy.hardBreak}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {inline.type !== "hardBreak" && (["bold", "italic", "underline"] as const).map(type => <Button key={type} aria-pressed={marks.some(mark => mark.type === type)}
        disabled={editor.hasPendingLinks} onClick={() => editor.mark(address, { type }, !marks.some(mark => mark.type === type))}>{copy[type]}</Button>)}
      <Button disabled={editor.hasPendingLinks} onClick={() => editor.edit(content => removeInline(content, address))}>{copy.remove}</Button>
    </div>
    {inline.type !== "hardBreak" && <div className="space-y-2">
      <label htmlFor={field.id} className="text-body text-foreground">{copy.link}</label>
      <Input id={field.id} dir="ltr" type="url" value={field.value} disabled={link?.attrs.source === "BINDING"}
        aria-invalid={field.invalid || undefined} aria-describedby={field.invalid ? `${field.id}-error` : undefined}
        onChange={event => editor.inputLink(address, event.currentTarget.value)} onBlur={editor.flushLinks}
        onCompositionStart={editor.compositionStart} onCompositionEnd={editor.compositionEnd} />
      {field.invalid && <p id={`${field.id}-error`} role="alert" className="text-body text-destructive">{copy.linkInvalid}</p>}
      {field.pending && <Button onClick={() => editor.revertLink(address)}>{copy.revertLink}</Button>}
      {link && <Button disabled={editor.hasPendingLinks} onClick={() => editor.mark(address, link, false)}>{copy.removeLink}</Button>}
    </div>}
  </div>;
}
