"use client";

import type { RealtimeApplicationStopReason } from "@mutakamel/realtime-app-client";
import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import type { ConnectivityStatus } from "./useConnectivity";

export interface OfflineBannerLabels {
  offline: string;
  draining: string;
  stopped: string;
  /** Only rendered for `stopped`, which no amount of waiting recovers from. */
  reload: string;
  /**
   * Why the client gave up, one entry per wire value.
   *
   * Keyed by `RealtimeApplicationStopReason` from the realtime package rather
   * than by a local list, so a reason added upstream fails the build here until
   * both dictionaries carry a sentence for it — the alternative is a reason
   * that silently renders as the generic line forever.
   */
  stopReasons: Record<RealtimeApplicationStopReason, string>;
}

export interface OfflineBannerProps {
  status: ConnectivityStatus;
  /**
   * The raw stop reason from `useConnectivity`, or `null`. Unrecognised values
   * fall back to the generic `stopped` sentence — a wire value is never shown.
   */
  stopReason?: string | null;
  labels: OfflineBannerLabels;
  /** Runs the reload. Kept as a prop so the banner never touches `location`. */
  onReload?: () => void;
  className?: string;
}

const MESSAGE_KEY: Record<
  Exclude<ConnectivityStatus, "online">,
  "offline" | "draining" | "stopped"
> = {
  offline: "offline",
  draining: "draining",
  stopped: "stopped",
};

/**
 * `Object.hasOwn`, not a bare index: `stopReason` arrives as an unvalidated
 * string off a `CustomEvent`, and a bare lookup would resolve `constructor` or
 * `toString` to something that is not a sentence.
 */
function readStopReason(
  labels: OfflineBannerLabels,
  stopReason: string | null | undefined,
): string | null {
  if (!stopReason || !Object.hasOwn(labels.stopReasons, stopReason)) return null;
  return labels.stopReasons[stopReason as RealtimeApplicationStopReason];
}

/**
 * The connection strip, mounted once in `AppShell`.
 *
 * Three states, three different truths, and collapsing them into one "you are
 * offline" would be wrong in two of the three:
 *
 * - **offline** — the browser lost the network. It comes back on its own.
 * - **draining** — the realtime server is shutting down and a reconnect is
 *   coming. Writes still work; live updates pause.
 * - **stopped** — the realtime client gave up permanently. Only a reload
 *   restores live updates, so this is the one state that gets an action.
 *
 * `caution`, not `negative`: none of the three means a request failed. It
 * takes `role="status"`, not `alert` — an assertive announcement would
 * interrupt whatever the user is reading for a condition they cannot act on.
 *
 * `stopped` also names **why**, when the client said why (MASTER-PLAN 13.5).
 * The five reasons are not interchangeable: a connection replaced by another
 * tab, access withdrawn, a workspace taken offline and a session that could not
 * be renewed each imply a different next move, and until now all five rendered
 * the same sentence.
 */
export function OfflineBanner({
  status,
  stopReason,
  labels,
  onReload,
  className,
}: OfflineBannerProps) {
  if (status === "online") return null;

  const Icon = status === "stopped" ? WifiOff : RefreshCw;
  const reason = status === "stopped" ? readStopReason(labels, stopReason) : null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-1.5 border-b border-caution-200 bg-caution-100 px-4 py-1.5 text-xs text-caution-800",
        "dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300",
        className,
      )}
    >
      <Icon className={cn(iconSize({ size: "md" }), "shrink-0")} aria-hidden="true" />
      <span>{reason ?? labels[MESSAGE_KEY[status]]}</span>
      {status === "stopped" && onReload && (
        <Button variant="link" size="xs" onClick={onReload} className="cursor-pointer text-xs">
          {labels.reload}
        </Button>
      )}
    </div>
  );
}
