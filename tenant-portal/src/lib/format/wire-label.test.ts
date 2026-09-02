import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWireLabelWarnings, wireLabel } from "./wire-label";

const UNKNOWN = "Unrecognized value ({code})";

afterEach(() => {
  resetWireLabelWarnings();
  vi.restoreAllMocks();
});

describe("wireLabel", () => {
  it("returns the translated label when the map has one", () => {
    expect(wireLabel({ ACTIVE: "Active" }, "ACTIVE", UNKNOWN, "status")).toBe("Active");
  });

  it("never returns the bare wire value", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rendered = wireLabel({}, "PAYMENT_HELD", UNKNOWN, "status");

    // The whole point: the code survives as evidence for a support ticket, but
    // it arrives inside a translated sentence rather than as a bare English
    // token on an Arabic screen.
    expect(rendered).toBe("Unrecognized value (PAYMENT_HELD)");
    expect(rendered).not.toBe("PAYMENT_HELD");
  });

  it("warns once per unseen code, not once per row", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let index = 0; index < 50; index += 1) {
      wireLabel({}, "NEW_FROM_BACKEND", UNKNOWN, "status");
    }
    expect(warn).toHaveBeenCalledTimes(1);

    wireLabel({}, "ANOTHER_NEW_ONE", UNKNOWN, "status");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("does not warn for a value it can translate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    wireLabel({ ACTIVE: "Active" }, "ACTIVE", UNKNOWN, "status");
    expect(warn).not.toHaveBeenCalled();
  });

  it("separates codes by group, so two enums sharing a value both report", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    wireLabel({}, "NONE", UNKNOWN, "dimensions");
    wireLabel({}, "NONE", UNKNOWN, "comparisons");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
