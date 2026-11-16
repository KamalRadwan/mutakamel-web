"use client";

import type { ReactNode } from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/design-system";

interface LeadStageActionProps {
  label: string;
  reason?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  children: ReactNode;
  text?: boolean;
}

export function LeadStageAction({ label, reason, disabled, loading, onClick, children, text }: LeadStageActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
          tabIndex={disabled ? 0 : undefined}
          role={disabled ? "group" : undefined}
          aria-disabled={disabled || undefined}
          aria-label={disabled ? `${label}. ${reason}` : undefined}
        >
          <Button variant={text ? "ghost" : "outline"} size="sm"
            className={text ? "disabled:pointer-events-none" : "size-8 p-0 disabled:pointer-events-none"}
            disabled={disabled} loading={loading} onClick={onClick} aria-label={label}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason ?? label}</TooltipContent>
    </Tooltip>
  );
}
