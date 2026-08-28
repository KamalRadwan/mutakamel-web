"use client";

import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "../../primitives/Button";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  className?: string;
}

// One icon, one line, one action — no illustration. A centred stock-SVG
// person-at-a-desk is the most generated thing a UI can contain; see
// docs/design/anti-patterns.md#the-visual-clichés--avoid-by-choice.
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-4 py-12 text-center ${className ?? ""}`}>
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
