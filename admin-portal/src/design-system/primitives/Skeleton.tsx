import { cn } from "../lib/cn";

/**
 * One of the design system's 3-gradient budget (docs/design-system/
 * geometry-and-density.md) — the shimmer sweep. Every other loading
 * placeholder in the app should use this instead of an ad hoc animate-pulse
 * block.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-primary-foreground/40 before:to-transparent motion-reduce:before:animate-none dark:before:via-primary-foreground/10",
        className,
      )}
      {...props}
    />
  );
}
