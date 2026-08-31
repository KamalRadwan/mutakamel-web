import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide rtl:normal-case rtl:tracking-normal",
  {
    variants: {
      tone: {
        success: "bg-success-subtle text-success-subtle-foreground",
        info: "bg-info-subtle text-info-subtle-foreground",
        brand: "bg-success-subtle text-success-subtle-foreground",
        danger: "bg-destructive-subtle text-destructive-subtle-foreground",
        warn: "bg-warning-subtle text-warning-subtle-foreground",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
