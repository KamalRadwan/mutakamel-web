import { afterEach, describe, expect, it, vi } from "vitest";

describe("Tenant Portal API ingress routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("proxies same-origin /api requests to the local Gateway in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_API_TARGET", "http://localhost:9100/");
    const config = (await import("./next.config")).default;

    await expect(runRewrites(config.rewrites)).resolves.toEqual([{
      source: "/api/:path*",
      destination: "http://localhost:9100/api/:path*",
    }]);
  });

  it("leaves production /api ingress ownership outside Next", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = (await import("./next.config")).default;

    await expect(runRewrites(config.rewrites)).resolves.toEqual([]);
  });
});

function runRewrites(rewrites: unknown): Promise<unknown> {
  if (typeof rewrites !== "function") {
    throw new Error("Expected rewrites to be configured");
  }
  return rewrites();
}
