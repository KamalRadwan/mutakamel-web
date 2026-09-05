import { describe, expect, it } from "vitest";
import {
  clearsPendingIntent,
  reconcilerForPendingIntent,
} from "./command-outcome";

/**
 * FE-OPS-001. The relocation and storage-migration wizards each persist two
 * command attempts, and each has its own reconciler. The mismatch state was a
 * boolean, so the banner could only ever offer the start reconciler: a
 * release-path mismatch cleared the wrong slot, and the next Release threw the
 * same PendingCommandIntentMismatchError with no request issued — a loop with
 * no exit but clearing session storage by hand.
 */
describe("pending intent reconciler routing", () => {
  it("routes each slot to the reconciler that owns it", () => {
    expect(reconcilerForPendingIntent("start")).toBe("start");
    expect(reconcilerForPendingIntent("release")).toBe("release");
    expect(reconcilerForPendingIntent(null)).toBeNull();
  });

  it("only the owning reconciler clears the stale attempt", () => {
    expect(clearsPendingIntent("release", "release")).toBe(true);
    // The defect: this is what the banner used to do for a release mismatch.
    expect(clearsPendingIntent("release", "start")).toBe(false);
    expect(clearsPendingIntent("start", "start")).toBe(true);
    expect(clearsPendingIntent("start", "release")).toBe(false);
  });

  it("has nothing to clear when no slot raised a mismatch", () => {
    expect(clearsPendingIntent(null, "start")).toBe(false);
    expect(clearsPendingIntent(null, "release")).toBe(false);
  });
});
