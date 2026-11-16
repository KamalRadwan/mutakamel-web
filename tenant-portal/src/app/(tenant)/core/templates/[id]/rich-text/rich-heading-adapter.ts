import { richClone, type RichBlock, type RichTextBlock, type RichParagraph, type RichDocument, type HeadingLevel } from "./rich-text-contract";

export function isRichTextBlock(block: RichBlock): block is RichTextBlock { return block.type === "paragraph" || block.type === "heading"; }
export function asParagraph(block: RichTextBlock): RichParagraph {
  if (block.type === "paragraph") return richClone(block);
  const paragraph: RichParagraph = { type: "paragraph" };
  if (block.attrs.textAlign !== undefined) paragraph.attrs = { textAlign: block.attrs.textAlign };
  if (block.content !== undefined) paragraph.content = richClone(block.content);
  return paragraph;
}
/** Explicit semantic conversion; no element style, layout, binding, inline mark or token edits. */
export function setHeading(document: RichDocument, index: number, level: HeadingLevel): RichDocument {
  if (!Number.isInteger(level) || level < 1 || level > 6 || !Number.isInteger(index) || !document.content[index]) throw new Error("Invalid heading address/level");
  const next = richClone(document), block = next.content[index];
  if (block.type === "heading") { block.attrs.level = level; return next; }
  const paragraphs = block.type === "paragraph" ? [block] : block.content.map(item => item.content[0]);
  next.content.splice(index, 1, ...paragraphs.map(paragraph => ({ ...paragraph, type: "heading" as const, attrs: { ...paragraph.attrs, level } })));
  return next;
}
/** Protect heading semantics; native admission owns canonical text normalization. */
export function preservesHeadings(candidate: RichDocument, admitted: unknown): boolean {
  const expected = candidate.content.flatMap((block, index) => block.type === "heading" ? [{ index, level: block.attrs.level, align: block.attrs.textAlign }] : []);
  if (!expected.length) return true;
  if (!admitted || typeof admitted !== "object" || !("content" in admitted) || !Array.isArray(admitted.content)) return false;
  const actual = admitted.content.flatMap((block: unknown, index: number) => {
    if (!block || typeof block !== "object" || !("type" in block) || block.type !== "heading" || !("attrs" in block) || !block.attrs || typeof block.attrs !== "object") return [];
    const attrs = block.attrs as Record<string, unknown>;
    return [{ index, level: attrs.level, align: attrs.textAlign }];
  });
  return JSON.stringify(actual) === JSON.stringify(expected);
}
