// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalTenantAuthState } from "./axiosClient";

describe("quotation handoff auth cleanup", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it("removes all actors' handoffs and the former key while preserving unrelated storage", () => {
    const prefix = "trade:quotation:composer-handoff";
    sessionStorage.setItem(prefix, "old draft");
    sessionStorage.setItem(`${prefix}:actor-a`, "draft A");
    sessionStorage.setItem(`${prefix}:actor-b`, "draft B");
    sessionStorage.setItem(`${prefix}-unrelated`, "keep");
    sessionStorage.setItem("another-feature", "keep");
    clearLocalTenantAuthState();
    expect(sessionStorage.getItem(prefix)).toBeNull();
    expect(sessionStorage.getItem(`${prefix}:actor-a`)).toBeNull();
    expect(sessionStorage.getItem(`${prefix}:actor-b`)).toBeNull();
    expect(sessionStorage.getItem(`${prefix}-unrelated`)).toBe("keep");
    expect(sessionStorage.getItem("another-feature")).toBe("keep");
  });

  it("completes auth cleanup when session storage is unavailable", () => {
    localStorage.setItem("tenant_auth_remember", "1");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    expect(() => clearLocalTenantAuthState()).not.toThrow();
    expect(localStorage.getItem("tenant_auth_remember")).toBeNull();
  });
});
