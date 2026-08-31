"use client";

import { Command } from "cmdk";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { iconSize } from "../lib/icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./Dialog";

export interface CommandItemDef {
  id: string;
  /** Already translated. */
  label: string;
  /** Extra terms the search matches — the route path, the other language's word for it. */
  keywords?: string[];
  icon?: LucideIcon;
  /** Right-aligned context — the section a route sits under. */
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface CommandGroupDef {
  id: string;
  /** Already translated. A group with no heading still groups. */
  heading?: string;
  items: CommandItemDef[];
}

export interface CommandPaletteLabels {
  /** Accessible name for the dialog and for `cmdk`'s listbox. */
  title: string;
  /** Explains what the palette does — read once by a screen reader on open. */
  description: string;
  placeholder: string;
  empty: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroupDef[];
  labels: CommandPaletteLabels;
  className?: string;
}

/**
 * The Ctrl/Cmd+K surface, built on `cmdk`.
 *
 * **No component stylesheet, and none needed** — MASTER-PLAN 1.40, recorded as
 * `docs/build/DECISIONS.md#d15--third-party-components-take-no-stylesheet--assumed`.
 * `cmdk` emits `[cmdk-root]`, `[cmdk-item]`, `[cmdk-group]` and friends as a
 * *convenience* for consumers who want to write CSS; they are not its styling
 * contract. Every part below takes a `className`, so the attributes sit in the
 * DOM matched by nothing.
 *
 * The single exception is the group heading: `cmdk` renders it in a child div
 * of its own and exposes no prop for it, so it is reached with a Tailwind
 * arbitrary variant on the group's own class list. That is a **utility in the
 * component**, which is exactly where `DESIGN-SYSTEM.md#5--no-stylesheet-of-component-classes`
 * says styling belongs — the ban is on a stylesheet of component classes, and
 * this adds no stylesheet, no `@apply` and no rule in `globals.css`.
 *
 * Radix's own `Dialog` is used rather than `Command.Dialog`, so the scrim, the
 * radius, the shadow, the z-index token and the enter/exit pair all come from
 * the design system instead of from a second, unstyled dialog implementation.
 */
export function CommandPalette({ open, onOpenChange, groups, labels, className }: CommandPaletteProps) {
  const nonEmpty = groups.filter((group) => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" showCloseButton={false} className={cn("gap-0 p-0", className)}>
        {/* Radix requires both, and a palette has no visible chrome to carry
            them — without a Title it warns and announces the dialog unnamed. */}
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        <DialogDescription className="sr-only">{labels.description}</DialogDescription>

        <Command
          label={labels.title}
          loop
          className="flex flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search
              className={cn(iconSize({ size: "lg" }), "text-muted-foreground")}
              aria-hidden="true"
            />
            <Command.Input
              placeholder={labels.placeholder}
              // text-base below sm, per DESIGN-SYSTEM.md#inputs-are-16px-on-mobile:
              // iOS Safari zooms the viewport on any focused input under 16px.
              className="h-(--size-control-xl) w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto overscroll-contain p-1">
            <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
              {labels.empty}
            </Command.Empty>

            {nonEmpty.map((group) => (
              <Command.Group
                key={group.id}
                heading={group.heading}
                className={cn(
                  "text-foreground",
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1",
                  "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
                  "[&_[cmdk-group-heading]]:text-muted-foreground",
                )}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      keywords={[item.label, ...(item.keywords ?? [])]}
                      disabled={item.disabled}
                      onSelect={item.onSelect}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm",
                        // cmdk drives selection with data-selected, which is
                        // what the keyboard moves. Hover alone would leave the
                        // arrow keys with no visible cursor.
                        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn(iconSize({ size: "md" }), "text-muted-foreground")}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                      {item.hint && (
                        <span className="ms-auto truncate text-xs text-muted-foreground">{item.hint}</span>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
