import { Loader2 } from "lucide-react";

// Minimal placeholder shown during route-segment loading — Phase 12 of the
// design-system migration replaces this with the real Skeleton pattern.
export default function ShellLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
