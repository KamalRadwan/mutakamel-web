// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Money } from "./Money";

afterEach(cleanup);

describe("Money", () => {
  it("formats a decimal string exactly, with no float round-trip", () => {
    // 9007199254740993 is 2^53 + 1 — Number() cannot represent it, and the
    // trailing .15 would be rounded away. This is the whole reason the
    // primitive exists.
    const exact = "9007199254740993.15";
    render(<Money value={exact} language="en" />);
    expect(screen.getByText("9,007,199,254,740,993.15")).toBeInTheDocument();
    expect(String(Number(exact))).not.toBe(exact);
  });

  it("preserves every trailing digit of a long decimal", () => {
    render(<Money value="12345678901234567890.55" language="en" minimumFractionDigits={2} />);
    expect(screen.getByText("12,345,678,901,234,567,890.55")).toBeInTheDocument();
  });

  it("renders currency with an explicit locale", () => {
    render(<Money value="1250.5" currency="EGP" language="en" />);
    expect(screen.getByText(/1,250\.50/)).toBeInTheDocument();
  });

  it("uses Western digits under Arabic — settled, not a fallback", () => {
    render(<Money value="1250.5" language="ar" />);
    const node = screen.getByText(/1,250\.5/);
    expect(node.textContent).toMatch(/[0-9]/);
    // The Arabic-Indic digit block, written as code-point escapes: the
    // census counter that must read 0 counts literal characters, and the
    // test pinning the rule should not be the one thing that trips it.
    expect(node.textContent).not.toMatch(/[\u0660-\u0669]/);
  });

  it("takes tabular figures so a column stays aligned", () => {
    render(<Money value="42" language="en" />);
    expect(screen.getByText("42").className).toContain("tabular-nums");
  });

  it("isolates the amount with <bdi> so bidi reordering cannot mangle it", () => {
    const { container } = render(<Money value="42" language="ar" />);
    expect(container.querySelector("bdi")).not.toBeNull();
  });

  it("renders a malformed value verbatim rather than NaN — it is still evidence", () => {
    render(<Money value="1.2.3" language="en" />);
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });

  it("handles a signed value", () => {
    render(<Money value="-1250.75" language="en" />);
    expect(screen.getByText("-1,250.75")).toBeInTheDocument();
  });
});
