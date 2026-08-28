import { useDirection } from "@/i18n/useLanguage";
import { cn } from "../lib/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

// The one permitted shimmer — docs/design/motion.md#shimmer. The sweep must
// mirror under RTL or it runs backwards against Arabic reading direction.
export function Skeleton({ className, ...props }: SkeletonProps) {
  const dir = useDirection();

  return (
    <div
      className={cn("relative overflow-hidden rounded-sm bg-muted", className)}
      {...props}
    >
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent",
          // The static starting position is the mirror image of the sweep's
          // own end point (see shimmer-rtl in globals.css) — together they
          // cover the full -100%..100% range in the direction that matches
          // reading order.
          dir === "rtl"
            ? "translate-x-full animate-[shimmer-rtl_1.4s_ease-in-out_infinite]"
            : "-translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite]",
        )}
      />
    </div>
  );
}
