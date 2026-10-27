"use client";

import { ChevronDown } from "lucide-react";
import { Button, cn } from "@/design-system";
import { crmBoardIconButtonClass } from "./board-classes";

export function CrmCardExpandButton({
  expanded,
  onClick,
  label,
  className,
}: {
  expanded: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className={cn(crmBoardIconButtonClass, className)}
    >
      <ChevronDown
        className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
        aria-hidden="true"
      />
    </Button>
  );
}
