import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(__dirname, "AuthContext.tsx"), "utf8");

describe("fresh sign-in signal", () => {
  /**
   * The invariant, rather than one example of it: every route that lands an
   * authenticated administrator on the dashboard is a sign-in, and the
   * browser-permission prompts key off exactly that. Asserted against source
   * because the point is to catch a *third* such path being added later —
   * a behavioural test only ever covers the paths someone remembered.
   *
   * There are two today: `login` (a password just typed) and `acceptInvite`
   * (the first sign-in an administrator ever makes, and the moment the
   * prompts matter most). Restores, refreshes and cross-tab adoption reach
   * AUTHENTICATED without pushing the dashboard, and must not count.
   */
  it("counts every path that lands an authenticated user on the dashboard", () => {
    const landings = SOURCE.split('router.push("/dashboard")').length - 1;
    const increments = SOURCE.split("setFreshLoginCount((count) => count + 1)").length - 1;

    expect(landings).toBeGreaterThan(0);
    expect(increments).toBe(landings);
  });

  /** A restore must not look like a sign-in, or the prompts fire on reload. */
  it("does not raise the signal on a bootstrap or adoption path", () => {
    for (const restore of ['router.replace("/login")', 'setAuthState("STALE")']) {
      const at = SOURCE.indexOf(restore);
      expect(at).toBeGreaterThan(-1);
      const nearby = SOURCE.slice(Math.max(0, at - 300), at);
      expect(nearby).not.toContain("setFreshLoginCount");
    }
  });
});
