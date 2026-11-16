"use client";

import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { templateRichTextCopy } from "@/i18n/template-rich-text-copy";
import type { BindingChoice, RichBridge, RichNative, RichResult, RichSession } from "./rich-text-contract";
import { addParagraph, changeBlock, removeBlock } from "./rich-text-adapter";
import { useRichTextEditor } from "./hooks/useRichTextEditor";
import { RichTextParagraph } from "./RichTextParagraph";
import { isRichTextBlock, setHeading } from "./rich-heading-adapter";
import type { RichTextLease } from "./rich-text-host-interlock";

/** Host remounts with an owner/generation/node session key; host owns Save and navigation fencing. */
export function StructuredTextEditor({ bridge, native, session, bindings, onComplete, onTextProperties, headingsEnabled = false, lease }: {
  bridge: RichBridge; native: RichNative; session: RichSession; bindings: readonly BindingChoice[];
  onComplete(result: RichResult): void; onTextProperties(): void;
  /** Root enables only after the template-owned schema/compiler/measure stack qualifies together. */
  headingsEnabled?: boolean; lease: RichTextLease;
}) {
  const { lang, dir } = useI18n(), copy = templateRichTextCopy[lang];
  const editor = useRichTextEditor(bridge, native, session, onComplete, lease);
  return <section dir={dir} className="space-y-4" aria-label={copy.title} onKeyDown={editor.keyDown}>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!editor.canUndo || editor.composing} onClick={editor.undo}>{copy.undo}</Button>
      <Button disabled={!editor.canRedo || editor.composing} onClick={editor.redo}>{copy.redo}</Button>
      <Button onClick={onTextProperties}>{copy.properties}</Button>
    </div>
    <p className="text-body text-muted-foreground">{copy.plainPaste}</p>
    <p className="text-body text-muted-foreground">{copy.normalization}</p>
    {!headingsEnabled && <p className="text-body text-muted-foreground">{copy.headings}</p>}
    {!bindings.length && <p className="text-body text-muted-foreground">{copy.bindingUnavailable}</p>}
    {editor.content.content.map((block, blockIndex) => <div key={`${blockIndex}:${block.type}`} className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={copy.title}>
        {(["paragraph", "bulletList", "orderedList"] as const).map(type => <Button key={type} aria-pressed={block.type === type} disabled={editor.composing || editor.hasPendingLinks}
          onClick={() => editor.edit(content => changeBlock(content, blockIndex, type))}>{copy[type]}</Button>)}
        <Button disabled={editor.composing || editor.hasPendingLinks} onClick={() => editor.edit(content => removeBlock(content, blockIndex))}>{copy.remove}</Button>
        {([1, 2, 3, 4, 5, 6] as const).map(level => <Button key={level} aria-label={copy[`heading${level}`]} disabled={!headingsEnabled || editor.composing || editor.hasPendingLinks}
          aria-pressed={block.type === "heading" && block.attrs.level === level} onClick={() => editor.edit(content => setHeading(content, blockIndex, level))}>{copy[`heading${level}`]}</Button>)}
      </div>
      {isRichTextBlock(block) ? <RichTextParagraph paragraph={block} address={{ block: blockIndex }} editor={editor} copy={copy} bindings={bindings} /> :
        block.content.map((item, itemIndex) => <RichTextParagraph key={itemIndex} paragraph={item.content[0]} address={{ block: blockIndex, item: itemIndex }} editor={editor} copy={copy} bindings={bindings} />)}
    </div>)}
    <Button disabled={editor.composing || editor.hasPendingLinks} onClick={() => editor.edit(addParagraph)}>{copy.addParagraph}</Button>
    {editor.result && <p role="status" className="text-body text-foreground">{copy[editor.result]}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={editor.composing || editor.hasInvalidLinks} onClick={editor.apply}>{copy.apply}</Button>
      <Button disabled={editor.composing} onClick={editor.discard}>{copy.discard}</Button>
    </div>
  </section>;
}
