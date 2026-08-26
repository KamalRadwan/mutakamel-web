import { Badge, type BadgeProps } from "@/design-system";

interface BackupStatusBadgeProps {
  status: string;
}

const positiveStatuses = new Set(["COMPLETED", "VERIFIED", "PROMOTED", "READY"]);
const activeStatuses = new Set(["PENDING", "RUNNING", "ROTATING"]);
const negativeStatuses = new Set(["FAILED", "CANCELLED", "EXPIRED", "BLOCKED"]);
const warningStatuses = new Set(["COMPLETED_WITH_ERRORS", "DEFERRED", "DUE"]);

// In-progress states get motion instead of a dedicated hue (docs/design-system —
// "in progress" is no longer blue; a pulsing dot survives colorblindness and the
// label already says RUNNING/PENDING/ROTATING).
export function BackupStatusBadge({ status }: BackupStatusBadgeProps) {
  const normalized = status.toUpperCase();
  const isActive = activeStatuses.has(normalized);
  const tone: NonNullable<BadgeProps["tone"]> = positiveStatuses.has(normalized)
    ? "brand"
    : negativeStatuses.has(normalized)
      ? "danger"
      : warningStatuses.has(normalized)
        ? "warn"
        : "neutral";

  return (
    <Badge tone={tone}>
      {isActive && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}
