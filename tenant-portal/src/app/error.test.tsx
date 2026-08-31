// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootError from "./error";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("root error boundary", () => {
  it("renders without an I18nProvider above it", () => {
    // The whole point of this file. A root boundary is a child of the ROOT
    // layout, which does not mount I18nProvider — that lives in
    // TenantPortalRuntime. If this component called useI18n() without
    // providing it, the boundary would throw and escalate to global-error,
    // replacing the document over a single failed page.
    expect(() =>
      render(<RootError error={new Error("boom")} unstable_retry={() => {}} />),
    ).not.toThrow();
  });

  it("offers a retry that calls Next's retry, not a reload", () => {
    const retry = vi.fn();
    render(<RootError error={new Error("boom")} unstable_retry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: /try again|إعادة/i }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("surfaces the digest, which is the only handle a user report has on the server log", () => {
    const error = Object.assign(new Error("boom"), { digest: "d1e2f3a4" });
    render(<RootError error={error} unstable_retry={() => {}} />);

    expect(screen.getByText(/d1e2f3a4/)).toBeInTheDocument();
  });

  it("omits the reference line entirely when there is no digest", () => {
    render(<RootError error={new Error("boom")} unstable_retry={() => {}} />);

    // Not "reference: undefined" — an empty label is worse than no label.
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("offers a way out of the failed route", () => {
    render(<RootError error={new Error("boom")} unstable_retry={() => {}} />);

    expect(screen.getByRole("link")).toHaveAttribute("href");
  });
});
