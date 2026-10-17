"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { Button } from "../../primitives/Button";
import { Input } from "../../primitives/Input";
import { Popover, PopoverAnchor, PopoverContent } from "../../primitives/Popover";
import { cn } from "../../lib/cn";
import { mirrorInRtl } from "../../lib/icons";
import { hitTarget } from "../../lib/variants";
import { useFilterSearchInput } from "./hooks/useFilterSearchInput";

export interface FilterSearchToken {
  id: string;
  label: string;
  value?: string;
  kind?: "filter" | "field";
}
export interface FilterSearchOption {
  id: string;
  label: string;
  description?: string;
  expandable?: boolean;
  search?: { prefix: string; field: string; connector: string; value: string };
}
export interface FilterSearchInputProps {
  query: string;
  tokens: readonly FilterSearchToken[];
  options: readonly FilterSearchOption[];
  prompt?: string;
  label: string;
  placeholder: string;
  optionsLabel: string;
  toggleLabel: string;
  emptyLabel: string;
  clearLabel: string;
  backLabel: string;
  removeLabel: (label: string) => string;
  disabled?: boolean;
  onQueryChange: (value: string) => void;
  onSelectOption: (id: string) => void;
  onRemoveToken: (id: string) => void;
  onClearPrompt: () => void;
  onClear: () => void;
}

/** A portalled combobox keeps suggestions visible outside scrolling action bars. */
export function FilterSearchInput(props: FilterSearchInputProps) {
  const {
    open, setOpen, rootRef, inputRef, tokensRef, listId, optionId, index: activeIndex,
    removeToken, onTokenKeyDown, clearPrompt, onQueryChange, onFocus, onKeyDown,
    clear, preventFocus, onInteractOutside, select, toggleSuggestions,
  } = useFilterSearchInput(props);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={rootRef}
          className={cn(
            "flex h-7 w-[444px] min-w-64 max-w-full items-center gap-0.5 rounded-md border border-input bg-card ps-1.5 text-foreground",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            props.disabled && "opacity-50",
          )}
        >
          <Search className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          {props.tokens.length > 0 && (
            <div ref={tokensRef} className="flex max-w-3/5 shrink items-center gap-0.5 overflow-x-auto">
              {props.tokens.map((token) => (
                <span key={token.id} className="inline-flex shrink-0 items-center overflow-hidden rounded-xs bg-secondary text-xs">
                  {token.kind === "filter" && <span className="flex size-5 items-center justify-center bg-primary text-primary-foreground">
                    <Filter className="size-3" aria-hidden="true" />
                  </span>}
                  <span className={cn(
                    "px-0.5 font-medium",
                    token.kind === "field" && "inline-flex self-stretch items-center bg-primary text-primary-foreground",
                  )}>{token.label}</span>
                  {token.value && <span className="max-w-32 truncate border-s border-border px-0.5" title={token.value}>{token.value}</span>}
                  <Button
                    data-filter-remove=""
                    variant="ghost" size="sm" className={cn("size-5 shrink-0 rounded-none p-0", hitTarget)}
                    disabled={props.disabled}
                    aria-label={props.removeLabel([token.label, token.value].filter(Boolean).join(": "))}
                    onClick={() => removeToken(token.id)}
                    onKeyDown={(event) => onTokenKeyDown(event, token.id)}
                  ><X className="size-3" aria-hidden="true" /></Button>
                </span>
              ))}
            </div>
          )}
          {props.prompt && (
            <Button variant="ghost" size="sm" className="h-6 max-w-28 shrink-0 gap-0.5 px-1"
              disabled={props.disabled} aria-label={props.backLabel} onClick={clearPrompt}>
              <ChevronLeft className={cn("size-3 shrink-0", mirrorInRtl)} aria-hidden="true" />
              <span className="truncate">{props.prompt}</span>
            </Button>
          )}
          <Input
            ref={inputRef} role="combobox" aria-autocomplete="list"
            aria-expanded={open} aria-controls={open ? listId : undefined}
            aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-label={props.label} placeholder={props.placeholder}
            value={props.query} disabled={props.disabled} autoComplete="off" maxLength={200}
            className="h-6 min-w-16 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            onChange={onQueryChange}
            onFocus={onFocus} onKeyDown={onKeyDown}
          />
          <Button variant="ghost" size="sm" className="h-full w-7 shrink-0 rounded-none border-s border-border p-0"
            disabled={props.disabled} aria-label={props.toggleLabel} aria-expanded={open}
            aria-controls={open ? listId : undefined} aria-haspopup="listbox"
            onMouseDown={preventFocus} onClick={toggleSuggestions}>
            <ChevronDown className="size-3" aria-hidden="true" />
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start" className="w-(--radix-popover-trigger-width) min-w-64 max-w-(--radix-popover-content-available-width) p-1"
        onOpenAutoFocus={preventFocus}
        onCloseAutoFocus={preventFocus}
        onInteractOutside={onInteractOutside}
      >
        <div id={listId} role="listbox" aria-label={props.optionsLabel} className="max-h-72 overflow-y-auto">
          {props.options.map((option, index) => (
            <Button key={option.id} id={optionId(index)} role="option" aria-selected={index === activeIndex}
              aria-label={option.label} aria-describedby={option.description ? `${optionId(index)}-hint` : undefined}
              tabIndex={-1} variant="ghost" size="sm" className={cn(
                "h-auto min-h-7 w-full flex-col items-start gap-0.5 whitespace-normal px-1.5 py-0.5 text-start font-normal",
                index === activeIndex && "bg-accent text-accent-foreground",
              )}
              onMouseDown={preventFocus} onClick={() => select(option.id)}>
              <span className="flex w-full items-start gap-1.5">
                <span className="flex w-3 shrink-0 items-center self-center">
                  {option.expandable && <ChevronRight className={cn("size-3", mirrorInRtl)} aria-hidden="true" />}
                </span>
                <span className="min-w-0 break-words">{option.search ? <>
                  {option.search.prefix} <span className="font-semibold">{option.search.field}</span>{" "}
                  {option.search.connector} <bdi className="font-semibold text-primary italic">{option.search.value}</bdi>
                </> : option.label}</span>
              </span>
              {option.description && <span id={`${optionId(index)}-hint`} className="ps-4.5 text-xs text-muted-foreground">{option.description}</span>}
            </Button>
          ))}
          {!props.options.length && <p role="status" className="p-1.5 text-xs text-muted-foreground">{props.emptyLabel}</p>}
        </div>
        {(props.tokens.length > 0 || props.query || props.prompt) && (
          <div className="mt-1 border-t border-border pt-1">
            <Button variant="ghost" size="sm" className="h-6 w-full justify-start text-start font-normal" disabled={props.disabled} onClick={clear}>
              {props.clearLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
