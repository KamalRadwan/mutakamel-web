import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 font-semibold",
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
      size: {
        default: "rounded-sm px-1.5 py-0.5 text-xs uppercase tracking-wide rtl:normal-case rtl:tracking-normal",
        sm: "h-6 rounded-md px-2 text-badge",
      },
    },
    defaultVariants: { tone: "neutral", size: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
