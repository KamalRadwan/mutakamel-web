"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ChangeEvent, type MouseEvent } from "react";
import type { FilterSearchInputProps } from "../FilterSearchInput";

export function useFilterSearchInput(props: FilterSearchInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tokensRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const index = Math.min(activeIndex, props.options.length - 1);
  const optionId = (position: number) => `${listId}-${position}`;
  const lastToken = props.tokens.at(-1)?.id;
  useEffect(() => {
    tokensRef.current?.lastElementChild?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [lastToken]);

  function select(id: string) {
    const selected = props.options.find((option) => option.id === id);
    props.onSelectOption(id);
    setActiveIndex(0);
    inputRef.current?.focus();
    setOpen(selected?.expandable === true);
  }

  function highlight(position: number) {
    setActiveIndex(position);
    document.getElementById(optionId(position))?.scrollIntoView?.({ block: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const count = props.options.length;
      if (count) highlight(open ? (index + (event.key === "ArrowDown" ? 1 : -1) + count) % count : 0);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (props.options[index]) select(props.options[index].id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      props.onClearPrompt();
    } else if (event.key === "Backspace" && !props.query) {
      if (props.prompt) {
        event.preventDefault();
        props.onClearPrompt();
      } else {
        // Focus before deleting, so an empty input cannot silently widen My Leads.
        const tokens = rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-filter-remove]");
        tokens?.item(tokens.length - 1)?.focus();
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function removeToken(id: string) {
    props.onRemoveToken(id);
    inputRef.current?.focus();
  }

  return {
    listId, optionId, inputRef, rootRef, tokensRef, index, open: open && !props.disabled,
    setOpen, select, onKeyDown, removeToken,
    toggleSuggestions() {
      inputRef.current?.focus();
      setActiveIndex(0);
      setOpen(!open);
    },
    onQueryChange(event: ChangeEvent<HTMLInputElement>) {
      props.onQueryChange(event.target.value);
      setActiveIndex(0);
      setOpen(true);
    },
    onFocus() { setOpen(true); },
    preventFocus(event: Event | MouseEvent) { event.preventDefault(); },
    onInteractOutside(event: CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) event.preventDefault();
    },
    onTokenKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeToken(id);
      }
    },
    clear() {
      props.onClear();
      setActiveIndex(0);
      inputRef.current?.focus();
    },
    clearPrompt() {
      props.onClearPrompt();
      setActiveIndex(0);
      inputRef.current?.focus();
    },
  };
}
