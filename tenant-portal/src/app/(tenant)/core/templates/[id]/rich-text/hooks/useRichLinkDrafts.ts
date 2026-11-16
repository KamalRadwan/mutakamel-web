"use client";

import { useId, useRef, useState } from "react";
import { markTextRange, richRun, safeLiteralLink } from "../rich-text-adapter";
import type { RichDocument, RunAddress } from "../rich-text-contract";

interface LinkDraft { address: RunAddress; value: string; baseline: string; rejected: boolean; range?: { start: number; end: number } }
type Drafts = Record<string, LinkDraft>;
interface LinkHost {
  read(): RichDocument;
  selection(): { address: RunAddress; start: number; end: number } | null;
  commit(change: (content: RichDocument) => RichDocument): boolean;
  invalid(): void;
}
const key = (address: RunAddress) => `${address.block}:${address.item ?? "root"}:${address.run}`;

/** Pending inputs stay outside the AST until every link can be committed atomically. */
export function useRichLinkDrafts(host: LinkHost) {
  const id = useId(), current = useRef<Drafts>({}), [drafts, setDrafts] = useState<Drafts>({});
  const publish = (value: Drafts) => { current.current = value; setDrafts(value); };
  const revert = (address: RunAddress) => {
    const next = { ...current.current }; delete next[key(address)]; publish(next);
  };
  const input = (address: RunAddress, value: string) => {
    const run = richRun(host.read(), address);
    if (run.type === "hardBreak") return;
    const previous = run.marks?.find(mark => mark.type === "link");
    if (previous?.attrs.source === "BINDING") return;
    const original = previous?.attrs.source === "LITERAL" ? previous.attrs.href : "";
    if (value === original) { revert(address); return; }
    const existing = current.current[key(address)], selected = host.selection();
    const range = selected && key(selected.address) === key(address) ? { start: selected.start, end: selected.end } : undefined;
    publish({ ...current.current, [key(address)]: { address: { ...address }, value, baseline: existing?.baseline ?? JSON.stringify(run), range: existing?.range ?? range, rejected: false } });
  };
  const flush = () => {
    const pending = Object.values(current.current);
    if (!pending.length) return true;
    if (pending.some(draft => !safeLiteralLink(draft.value))) { host.invalid(); return false; }
    try {
      if (pending.some(draft => JSON.stringify(richRun(host.read(), draft.address)) !== draft.baseline)) { host.invalid(); return false; }
      // A selected-range mark may split a run. Descending addresses preserve every other input's origin.
      pending.sort((a, b) => b.address.block - a.address.block || (b.address.item ?? -1) - (a.address.item ?? -1) || b.address.run - a.address.run);
      const committed = host.commit(content => pending.reduce((next, draft) => {
        const run = richRun(next, draft.address), previous = run.type === "hardBreak" ? undefined : run.marks?.find(mark => mark.type === "link");
        return markTextRange(next, draft.address, draft.range?.start ?? 0, draft.range?.end ?? 0,
          { type: "link", attrs: { source: "LITERAL", href: draft.value, target: previous?.attrs.target ?? "SAME_WINDOW" } }, true);
      }, content));
      if (committed) { publish({}); return true; }
      publish(Object.fromEntries(Object.entries(current.current).map(([name, draft]) => [name, { ...draft, rejected: true }])));
    } catch { host.invalid(); }
    return false;
  };
  return {
    input, flush, revert,
    hasPending: () => Object.keys(current.current).length > 0,
    hasPendingLinks: Object.keys(drafts).length > 0,
    hasInvalidLinks: Object.values(drafts).some(draft => !safeLiteralLink(draft.value) || draft.rejected),
    field(address: RunAddress, href: string) {
      const draft = drafts[key(address)];
      return { id: `${id}-link-${key(address)}`, value: draft?.value ?? href, pending: !!draft, invalid: !!draft && (!safeLiteralLink(draft.value) || draft.rejected) };
    },
  };
}
