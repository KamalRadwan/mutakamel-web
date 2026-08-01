"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpportunityImportanceStarsProps {
  importance: number;
  onChange?: (newImportance: number) => void;
  className?: string;
  starClassName?: string;
}

export function OpportunityImportanceStars({ 
  importance, 
  onChange,
  className,
  starClassName
}: OpportunityImportanceStarsProps) {
  return (
    <div className={cn("flex gap-0.5", className)} title="الأهمية (اضغط للتعديل)">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(star);
          }}
          disabled={!onChange}
          className={cn(
            "transition-transform hover:scale-110 disabled:hover:scale-100 disabled:cursor-default",
            !onChange && "cursor-default"
          )}
        >
          <Star
            className={cn(
              "w-3.5 h-3.5 transition-colors", 
              star <= importance ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-700",
              starClassName
            )}
          />
        </button>
      ))}
    </div>
  );
}
