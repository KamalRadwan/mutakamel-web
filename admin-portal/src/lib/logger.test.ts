// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive keys before logging", () => {
    logger.error("webphone registration failed", {
      sipPassword: "hunter2",
      token: "abc.def.ghi",
      userId: "u-1",
    });

    expect(console.error).toHaveBeenCalledWith(
      "[error]",
      "webphone registration failed",
      expect.objectContaining({
        sipPassword: "[redacted]",
        token: "[redacted]",
        userId: "u-1",
      }),
    );
  });

  it("redacts sensitive keys inside nested objects and arrays", () => {
    logger.warn("bulk update", {
      items: [{ credential: "secret-value", id: 1 }],
    });

    expect(console.warn).toHaveBeenCalledWith(
      "[warn]",
      "bulk update",
      expect.objectContaining({
        items: [expect.objectContaining({ credential: "[redacted]", id: 1 })],
      }),
    );
  });

  it("serializes Error instances without leaking extra properties", () => {
    logger.error("boom", { error: new Error("nope") });

    const [, , context] = (console.error as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [string, string, Record<string, unknown>];
    expect(context.error).toMatchObject({ name: "Error", message: "nope" });
  });

  it("suppresses levels below the configured threshold", () => {
    window.localStorage.setItem("mutakamel:log-level", "warn");

    logger.debug("should be suppressed");
    logger.info("should be suppressed too");
    logger.warn("should appear");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to the default level when storage holds an invalid value", () => {
    window.localStorage.setItem("mutakamel:log-level", "not-a-level");

    logger.debug("visible in development default");

    expect(console.debug).toHaveBeenCalled();
  });
});
