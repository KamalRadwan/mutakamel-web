import { afterEach, describe, expect, it, vi } from "vitest";

describe("Tenant Portal API ingress routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("leaves development API handling to the Host-preserving route handler", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_API_TARGET", "http://localhost:9100/");
    const config = (await import("./next.config")).default;

    expect(config.rewrites).toBeUndefined();
  });

  it("leaves production /api ingress ownership outside Next", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = (await import("./next.config")).default;

    expect(config.rewrites).toBeUndefined();
  });
});
