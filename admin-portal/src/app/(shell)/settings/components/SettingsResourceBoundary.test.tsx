// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsResourceBoundary } from "./SettingsResourceBoundary";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

describe("SettingsResourceBoundary", () => {
  it("distinguishes forbidden from unavailable and exposes retry only when safe", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <SettingsResourceBoundary
        state="FORBIDDEN"
        lang="en"
        onRetry={retry}
      >
        <p>hidden settings</p>
      </SettingsResourceBoundary>,
    );
    expect(screen.getByText("Settings read permission required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByText("hidden settings")).toBeNull();

    rerender(
      <SettingsResourceBoundary
        state="UNAVAILABLE"
        lang="en"
        error={{
          isNormalized: true,
          httpStatus: 503,
          errorCode: "CORE_DOWN",
          message: "raw backend text",
          correlationId: "corr-safe",
        }}
        onRetry={retry}
      >
        <p>hidden settings</p>
      </SettingsResourceBoundary>,
    );
    expect(screen.getByText("Settings service is unavailable")).toBeTruthy();
    expect(screen.queryByText("raw backend text")).toBeNull();
    expect(screen.getByText("CORE_DOWN")).toBeTruthy();
    expect(screen.getByText("corr-safe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
