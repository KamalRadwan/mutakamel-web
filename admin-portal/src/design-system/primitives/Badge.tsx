import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        brand: "bg-brand-500/15 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
        danger: "bg-danger-500/15 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300",
        warn: "bg-warn-500/15 text-warn-800 dark:bg-warn-500/20 dark:text-warn-300",
        neutral: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
