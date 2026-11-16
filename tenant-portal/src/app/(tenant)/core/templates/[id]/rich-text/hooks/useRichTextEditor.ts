"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type SyntheticEvent, type KeyboardEvent } from "react";
import { richHistory, editRichHistory, stepRichHistory, validateRichContent, applyRichSession } from "../rich-text-session";
import { pastePlain, replaceText, markTextRange, richRun, insertAtTextRange, insertInline } from "../rich-text-adapter";
import type { RichBridge, RichNative, RichSession, RichDocument, RunAddress, RichResult, RichMark, ParagraphAddress, RichInline } from "../rich-text-contract";
import type { RichTextLease } from "../rich-text-host-interlock";
import { useRichLinkDrafts } from "./useRichLinkDrafts";

export function useRichTextEditor(bridge: RichBridge, native: RichNative, session: RichSession, onComplete: (result: RichResult) => void, lease?: RichTextLease) {
  const [history, setHistory] = useState(() => richHistory(session.content));
  const historyRef = useRef(history);
  const initial = useRef(session);
  const selection = useRef<{ address: RunAddress; start: number; end: number } | null>(null);
  const [result, setResult] = useState<RichResult | null>(null);
  const [composing, setComposing] = useState(false);
  const editInternal = (change: (content: RichDocument) => RichDocument, gesture: string | null = null, linkCommit = false) => {
    if (session !== initial.current || (lease && !lease.matches(session))) { setResult("stale"); return false; }
    if (!linkCommit && links.hasPending()) { setResult("invalid"); return false; }
    try {
      const next = change(historyRef.current.present);
      if (!validateRichContent(bridge, native, session, next)) { setResult("invalid"); return false; }
      historyRef.current = editRichHistory(historyRef.current, next, gesture);
      selection.current = null;
      setHistory(historyRef.current); setResult(null); return true;
    } catch { setResult("invalid"); return false; }
  };
  const links = useRichLinkDrafts({ read: () => historyRef.current.present, selection: () => selection.current,
    commit: change => editInternal(change, null, true), invalid: () => setResult("invalid") });
  useEffect(() => { lease?.update(session, { dirty: links.hasPendingLinks || JSON.stringify(history.present) !== JSON.stringify(session.original), composing }); }, [lease, session, history.present, composing, links.hasPendingLinks]);
  const edit = (change: (content: RichDocument) => RichDocument, gesture: string | null = null) => editInternal(change, gesture);
  const finishGesture = () => { historyRef.current = { ...historyRef.current, gesture: null }; setHistory(historyRef.current); };
  const paste = (event: ClipboardEvent<HTMLTextAreaElement>, address: RunAddress) => {
    event.preventDefault();
    const { selectionStart, selectionEnd } = event.currentTarget;
    edit(content => pastePlain(content, address, selectionStart, selectionEnd, event.clipboardData.getData("text/plain")));
    selection.current = null;
  };
  const mark = (address: RunAddress, value: RichMark, enabled: boolean) => {
    const range = selection.current, run = richRun(historyRef.current.present, address);
    const matches = range && JSON.stringify(range.address) === JSON.stringify(address) && run.type === "text";
    edit(content => markTextRange(content, address, matches ? range.start : 0, matches ? range.end : 0, value, enabled));
    selection.current = null;
  };
  const link = (address: RunAddress, href: string) => {
    links.input(address, href); return links.flush();
  };
  const apply = () => {
    if (composing) return;
    if (session !== initial.current || (lease && !lease.matches(session))) { setResult("stale"); return; }
    if (!links.flush()) return;
    const status = applyRichSession(bridge, native, { ...session, content: historyRef.current.present });
    setResult(status);
    if (status === "applied" || status === "unchanged") { lease?.release(); onComplete(status); }
  };
  const step = (direction: "undo" | "redo") => {
    if (links.hasPending()) { setResult("invalid"); return; }
    selection.current = null; historyRef.current = stepRichHistory(historyRef.current, direction); setHistory(historyRef.current);
  };
  return { content: history.present, result, composing, canUndo: !!history.past.length && !links.hasPendingLinks, canRedo: !!history.future.length && !links.hasPendingLinks,
    hasPendingLinks: links.hasPendingLinks, hasInvalidLinks: links.hasInvalidLinks, linkField: links.field,
    inputLink: links.input, flushLinks: () => !composing && links.flush(), revertLink: (address: RunAddress) => { links.revert(address); setResult(null); },
    edit, finishGesture, paste, link, mark, apply, discard: () => { lease?.release(); onComplete("unchanged"); },
    select: (event: SyntheticEvent<HTMLTextAreaElement>, address: RunAddress) => { selection.current = { address, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; },
    insert: (address: ParagraphAddress, index: number, inline: RichInline) => {
      const range = selection.current;
      edit(content => range && range.address.block === address.block && range.address.item === address.item ?
        insertAtTextRange(content, range.address, range.start, range.end, inline) : insertInline(content, address, index, inline));
      selection.current = null;
    },
    text: (address: RunAddress, text: string) => { selection.current = null; return edit(content => replaceText(content, address, text), JSON.stringify(address)); },
    undo: () => step("undo"), redo: () => step("redo"),
    keyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (composing || event.nativeEvent.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if ((event.target as HTMLElement).tagName === "INPUT") return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") { event.preventDefault(); step(key === "y" || event.shiftKey ? "redo" : "undo"); }
    },
    compositionStart: () => setComposing(true), compositionEnd: () => { setComposing(false); finishGesture(); } };
}
export type RichTextEditorController = ReturnType<typeof useRichTextEditor>;
