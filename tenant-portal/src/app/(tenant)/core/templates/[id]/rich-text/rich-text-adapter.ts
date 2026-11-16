import { richClone, type ParagraphAddress, type RunAddress, type RichDocument, type RichParagraph, type RichTextBlock, type RichInline, type RichMark, type Alignment } from "./rich-text-contract";
import { isRichTextBlock, asParagraph } from "./rich-heading-adapter";

export function richParagraph(document: RichDocument, address: ParagraphAddress): RichTextBlock {
  const block = document.content[address.block];
  if (!block || (isRichTextBlock(block) ? address.item !== undefined : address.item === undefined)) throw new Error("Invalid paragraph address");
  const paragraph = isRichTextBlock(block) ? block : block.content[address.item!]?.content[0];
  if (!paragraph) throw new Error("Invalid list item address");
  return paragraph;
}
export function changeParagraph(document: RichDocument, address: ParagraphAddress, change: (paragraph: RichTextBlock) => void): RichDocument {
  const next = richClone(document); change(richParagraph(next, address)); return next;
}
export function richRun(document: RichDocument, address: RunAddress): RichInline {
  const run = richParagraph(document, address).content?.[address.run];
  if (!run) throw new Error("Invalid inline address");
  return run;
}

/** DOM selection uses UTF-16; never cut an Arabic mark, surrogate pair or ZWJ cluster. */
export function graphemeRange(text: string, start: number, end: number): [number, number] {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length) throw new Error("Invalid text selection");
  const points = [0, ...Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), part => part.index + part.segment.length)];
  const from = points.filter(point => point <= start).at(-1)!;
  return [from, start === end ? from : points.find(point => point >= end)!];
}
export function replaceText(document: RichDocument, address: RunAddress, text: string): RichDocument {
  const current = richRun(document, address);
  if (current.type !== "text") throw new Error("Text run required");
  if (/[\r\n]/.test(text)) return pastePlain(document, address, 0, current.text.length, text);
  return changeParagraph(document, address, paragraph => {
    const run = paragraph.content?.[address.run];
    if (run?.type !== "text") throw new Error("Text run required");
    run.text = text;
  });
}
export function pastePlain(document: RichDocument, address: RunAddress, start: number, end: number, plain: string): RichDocument {
  const run = richRun(document, address);
  if (run.type !== "text") throw new Error("Text run required");
  const [from, to] = graphemeRange(run.text, start, end);
  const pieces = plain.replace(/\r\n?/g, "\n").split("\n");
  return changeParagraph(document, address, paragraph => {
    const replacement: RichInline[] = [];
    pieces.forEach((piece, index) => {
      if (index) replacement.push({ type: "hardBreak" });
      replacement.push({ ...richClone(run), text: (index === 0 ? run.text.slice(0, from) : "") + piece + (index === pieces.length - 1 ? run.text.slice(to) : "") });
    });
    paragraph.content!.splice(address.run, 1, ...replacement);
  });
}
export function setRunMark(document: RichDocument, address: RunAddress, mark: RichMark, enabled: boolean): RichDocument {
  return changeParagraph(document, address, paragraph => {
    const run = paragraph.content?.[address.run];
    if (!run || run.type === "hardBreak") throw new Error("Markable run required");
    const marks = (run.marks ?? []).filter(existing => existing.type !== mark.type);
    if (enabled) marks.push(richClone(mark));
    if (marks.length) run.marks = marks; else delete run.marks;
  });
}
export function markTextRange(document: RichDocument, address: RunAddress, start: number, end: number, mark: RichMark, enabled: boolean): RichDocument {
  const run = richRun(document, address);
  if (run.type !== "text" || start === end) return setRunMark(document, address, mark, enabled);
  const [from, to] = graphemeRange(run.text, start, end);
  const changed = setRunMark(document, address, mark, enabled), marked = richRun(changed, address);
  if (marked.type !== "text") throw new Error("Text run required");
  return changeParagraph(document, address, paragraph => {
    paragraph.content!.splice(address.run, 1, ...(from ? [{ ...richClone(run), text: run.text.slice(0, from) }] : []),
      { ...marked, text: run.text.slice(from, to) }, ...(to < run.text.length ? [{ ...richClone(run), text: run.text.slice(to) }] : []));
  });
}
export function insertAtTextRange(document: RichDocument, address: RunAddress, start: number, end: number, inline: RichInline): RichDocument {
  const run = richRun(document, address);
  if (run.type !== "text") throw new Error("Text run required");
  const [from, to] = graphemeRange(run.text, start, end);
  return changeParagraph(document, address, paragraph => {
    paragraph.content!.splice(address.run, 1, ...(from ? [{ ...richClone(run), text: run.text.slice(0, from) }] : []), richClone(inline),
      ...(to < run.text.length ? [{ ...richClone(run), text: run.text.slice(to) }] : []));
  });
}
export function safeLiteralLink(href: string): string | null {
  // Same allowlist as schema base-validation: HTTPS only. Never coerce a relative/protocol URL.
  if (href !== href.trim() || /[\u0000-\u0020\u007f\\]/.test(href) || !/^https:\/\//i.test(href)) return null;
  try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password ? href : null; } catch { return null; }
}
export function setAlignment(document: RichDocument, address: ParagraphAddress, alignment: Alignment): RichDocument {
  return changeParagraph(document, address, paragraph => { paragraph.attrs = { ...paragraph.attrs, textAlign: alignment }; });
}
export function changeBlock(document: RichDocument, index: number, type: "paragraph" | "bulletList" | "orderedList"): RichDocument {
  const next = richClone(document), block = next.content[index];
  if (!block) throw new Error("Invalid block address");
  if (block.type === type) return next;
  const paragraphs = isRichTextBlock(block) ? [asParagraph(block)] : block.content.map(item => item.content[0]);
  next.content.splice(index, 1, ...(type === "paragraph" ? paragraphs : [{ type, content: paragraphs.map(paragraph => ({ type: "listItem" as const, content: [paragraph] as [RichParagraph] })) }]));
  return next;
}
export function insertInline(document: RichDocument, address: ParagraphAddress, index: number, inline: RichInline): RichDocument {
  return changeParagraph(document, address, paragraph => {
    const content = paragraph.content ?? [];
    if (!Number.isInteger(index) || index < 0 || index > content.length) throw new Error("Invalid insertion address");
    paragraph.content = [...content.slice(0, index), richClone(inline), ...content.slice(index)];
  });
}
export function removeInline(document: RichDocument, address: RunAddress): RichDocument {
  richRun(document, address);
  return changeParagraph(document, address, paragraph => { paragraph.content!.splice(address.run, 1); });
}
export function addParagraph(document: RichDocument): RichDocument { return { ...richClone(document), content: [...richClone(document.content), { type: "paragraph", content: [] }] }; }
export function removeBlock(document: RichDocument, index: number): RichDocument {
  if (!Number.isInteger(index) || !document.content[index]) throw new Error("Invalid block address");
  const next = richClone(document); next.content.splice(index, 1); return next;
}
export function changeListItem(document: RichDocument, blockIndex: number, itemIndex: number, action: "insert" | "remove"): RichDocument {
  const next = richClone(document), block = next.content[blockIndex];
  if (!block || isRichTextBlock(block) || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= block.content.length) throw new Error("Invalid list item address");
  if (action === "insert") block.content.splice(itemIndex + 1, 0, { type: "listItem", content: [{ type: "paragraph", content: [] }] });
  else if (block.content.length === 1) next.content.splice(blockIndex, 1); else block.content.splice(itemIndex, 1);
  return next;
}
