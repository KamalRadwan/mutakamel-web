"use client";

import { Button } from "@/design-system";
import type { RichTextCopy } from "@/i18n/template-rich-text-copy";
import { setAlignment, changeListItem } from "./rich-text-adapter";
import type { BindingChoice, ParagraphAddress, RichTextBlock } from "./rich-text-contract";
import type { RichTextEditorController } from "./hooks/useRichTextEditor";
import { RichTextRun } from "./RichTextRun";

export function RichTextParagraph({ paragraph, address, editor, copy, bindings }: {
  paragraph: RichTextBlock; address: ParagraphAddress; editor: RichTextEditorController; copy: RichTextCopy; bindings: readonly BindingChoice[];
}) {
  return <section className="space-y-3 rounded-md border border-border p-3" aria-label={copy.paragraph}>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={copy.align}>
      {(["START", "CENTER", "END", "JUSTIFY"] as const).map(alignment => <Button key={alignment} disabled={editor.hasPendingLinks} aria-pressed={paragraph.attrs?.textAlign === alignment}
        onClick={() => editor.edit(content => setAlignment(content, address, alignment))}>{copy[alignment]}</Button>)}
    </div>
    {(paragraph.content ?? []).map((inline, run) => <RichTextRun key={`${run}:${inline.type}`} inline={inline} address={{ ...address, run }} editor={editor} copy={copy} bindings={bindings} />)}
    <div className="flex flex-wrap gap-2">
      <Button disabled={editor.hasPendingLinks} onClick={() => editor.insert(address, paragraph.content?.length ?? 0, { type: "text", text: "" })}>{copy.addText}</Button>
      <Button disabled={editor.hasPendingLinks} onClick={() => editor.insert(address, paragraph.content?.length ?? 0, { type: "hardBreak" })}>{copy.addBreak}</Button>
      {bindings.map(choice => <Button key={choice.key} disabled={editor.hasPendingLinks} onClick={() => editor.insert(address, paragraph.content?.length ?? 0, { type: "variable", attrs: { binding: choice.binding } })}>{copy.variable}: <bdi>{choice.label}</bdi></Button>)}
      {address.item !== undefined && <>
        <Button disabled={editor.hasPendingLinks} onClick={() => editor.edit(content => changeListItem(content, address.block, address.item!, "insert"))}>{copy.addItem}</Button>
        <Button disabled={editor.hasPendingLinks} onClick={() => editor.edit(content => changeListItem(content, address.block, address.item!, "remove"))}>{copy.removeItem}</Button>
      </>}
    </div>
  </section>;
}
