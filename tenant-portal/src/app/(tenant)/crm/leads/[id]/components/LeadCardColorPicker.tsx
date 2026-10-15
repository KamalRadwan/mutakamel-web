"use client";

import { Ban } from "lucide-react";
import {
  Button,
  CARD_COLORS,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  cardColorFill,
  cn,
  type CardColor,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

const SWATCH_CHOICES: readonly (CardColor | null)[] = [null, ...CARD_COLORS];

function Swatch({ color, selected }: { color: CardColor | null; selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center rounded-xs",
        color === null && "border border-input",
        color !== null && cardColorFill(color),
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
      )}
    >
      {color === null && <Ban className="size-3 text-muted-foreground" aria-hidden="true" />}
    </span>
  );
}

/** The lead's filing colour — the same eleven marks the board card menu offers. */
export function LeadCardColorPicker({ value, disabled, onChange }: {
  value: CardColor | null;
  disabled: boolean;
  onChange: (next: CardColor | null) => void;
}) {
  const { t } = useI18n();
  const labels = t.crmLeads.card;
  const nameOf = (color: CardColor | null) => (color === null ? labels.colorNone : labels.colors[color]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" disabled={disabled}
          aria-label={`${labels.cardColor}: ${nameOf(value)}`} title={labels.cardColor}>
          <Swatch color={value} selected={false} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{labels.cardColor}</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1 p-1">
          {SWATCH_CHOICES.map((color) => {
            const isCurrent = color === value;
            const name = nameOf(color);
            return (
              <DropdownMenuItem key={color ?? "NONE"} textValue={name}
                aria-label={isCurrent ? `${name} — ${labels.colorSelected}` : name}
                onSelect={() => { if (!isCurrent) onChange(color); }}
                className="size-7 justify-center p-0">
                <Swatch color={color} selected={isCurrent} />
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
