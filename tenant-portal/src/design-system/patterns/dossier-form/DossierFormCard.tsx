"use client";

import { useId, type ReactNode } from "react";
import { Check, Star, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import { DOSSIER_CARD_TONE_CLASSES, type DossierCardTone } from "../dossier-modal/dossier-modal-tokens";
import { useDossierChoiceNavigation } from "./useDossierChoiceNavigation";

const HEADER_TONES: Record<DossierCardTone, string> = {
  indigo: "dossier-card-header-editing-indigo",
  violet: "dossier-card-header-editing-violet",
  emerald: "bg-none! bg-swatch-green-soft!",
  amber: "bg-none! bg-swatch-amber-soft!",
  cyan: "dossier-card-header-editing-cyan",
};

const TOP_ACCENTS: Record<DossierCardTone, string> = {
  indigo: "border-t-swatch-indigo!",
  violet: "border-t-swatch-purple!",
  emerald: "border-t-swatch-green!",
  amber: "border-t-swatch-amber!",
  cyan: "border-t-accent-500!",
};

export interface DossierFormCardProps {
  title: string;
  icon: LucideIcon;
  tone: DossierCardTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function DossierFormCard({ title, icon: Icon, tone, children, action, className }: DossierFormCardProps) {
  const titleId = useId();
  const tokens = DOSSIER_CARD_TONE_CLASSES[tone];
  return (
    <section aria-labelledby={titleId} className={cn(tokens.card, "min-w-0 border-t-[3px]!", TOP_ACCENTS[tone], className)}>
      <div className={cn("dossier-card-header px-3! py-2!", HEADER_TONES[tone])}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={tokens.iconPill}><Icon className="size-4" aria-hidden="true" /></span>
          <h2 id={titleId} className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="dossier-card-body flex flex-col gap-2 p-3!">{children}</div>
    </section>
  );
}

export function DossierFormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[1.1fr_1fr]", className)}>{children}</div>;
}

export function DossierFormModeSwitch({ expanded, onExpandedChange, compactLabel, expandedLabel, disabled }: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  compactLabel: string;
  expandedLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line-control bg-surface-subtle p-0.5" role="group" aria-label={`${compactLabel} / ${expandedLabel}`}>
      {[false, true].map((value) => (
        <Button key={String(value)} type="button" size="sm" variant="ghost" disabled={disabled}
          aria-pressed={expanded === value} onClick={() => onExpandedChange(value)}
          className={cn("min-w-24 rounded-md max-sm:min-h-11 max-sm:min-w-28", expanded === value && "bg-gradient-primary text-white shadow-sm hover:text-white")}>
          {value ? expandedLabel : compactLabel}
        </Button>
      ))}
    </div>
  );
}

export function DossierFormStars({ value, label, levelLabel, onChange, onBlur, disabled, error }: {
  value: number;
  label: string;
  levelLabel: (value: number) => string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const navigate = useDossierChoiceNavigation(["1", "2", "3"], String(value), (next) => onChange(Number(next)), disabled);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-xs font-medium text-foreground">{label}</span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined} tabIndex={error ? -1 : undefined}
        className="flex min-h-10 items-center gap-1.5 rounded-lg border border-swatch-amber/30 bg-swatch-amber-soft px-2 py-1 text-warning" onBlur={onBlur} onKeyDown={navigate}>
        {[1, 2, 3].map((level) => (
          <Button key={level} type="button" variant="ghost" size="sm" disabled={disabled}
            role="radio" aria-label={levelLabel(level === value ? 0 : level)} aria-checked={value === level}
            tabIndex={level === (value || 1) ? 0 : -1}
            onClick={() => onChange(level === value ? 0 : level)} className="size-9 p-1 text-warning hover:text-warning max-sm:size-11">
            <Star className={cn("size-6", level <= value && "fill-current")} aria-hidden="true" />
          </Button>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function DossierFormChoices({ label, options, value, onChange, disabled, error, emptyLabel }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  emptyLabel?: string;
}) {
  const id = useId();
  const navigate = useDossierChoiceNavigation(options.map((option) => option.value), value, onChange, disabled);
  return <div className="flex flex-col gap-1.5">
    <span id={`${id}-label`} className="text-xs font-medium text-foreground">{label}<span className="text-destructive"> *</span></span>
    <div role="radiogroup" aria-labelledby={`${id}-label`} aria-required aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined} onKeyDown={navigate}
      className="flex min-h-8 flex-wrap items-center gap-1.5" tabIndex={error ? -1 : undefined}>
      {options.map((option, index) => <Button key={option.value} type="button" role="radio" size="sm" variant="outline"
        disabled={disabled} title={option.label} aria-checked={value === option.value} tabIndex={value === option.value || (!value && index === 0) ? 0 : -1}
        className={cn("min-w-20 flex-1 max-sm:min-h-11 max-sm:min-w-24", value === option.value && "bg-gradient-primary text-white hover:text-white")}
        onClick={() => onChange(option.value)}>
        {value === option.value && <Check className="size-3.5 shrink-0" aria-hidden="true" />}<span className="min-w-0 truncate">{option.label}</span>
      </Button>)}
    </div>
    {options.length === 0 && emptyLabel && <p role="status" className="text-xs text-muted-foreground">{emptyLabel}</p>}
    {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
  </div>;
}
