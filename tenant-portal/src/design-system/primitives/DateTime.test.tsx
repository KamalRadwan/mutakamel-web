// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "./DateTime";

afterEach(cleanup);

const TIMESTAMP = "2026-03-15T09:30:00.000Z";

describe("DateTime", () => {
  it("keeps the wire value machine-readable in <time dateTime>", () => {
    const { container } = render(
      <DateTime value={TIMESTAMP} language="en" timeZone="UTC" precision="date" />,
    );
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", TIMESTAMP);
  });

  it("formats with an explicit locale, never the runtime default", () => {
    render(<DateTime value={TIMESTAMP} language="en" timeZone="UTC" precision="date" />);
    expect(screen.getByText("Mar 15, 2026")).toBeInTheDocument();
  });

  it("renders Arabic month names with Western digits", () => {
    render(<DateTime value={TIMESTAMP} language="ar" timeZone="UTC" precision="date" />);
    const node = screen.getByText(/2026/);
    expect(node.textContent).toMatch(/مارس/);
    // The Arabic-Indic digit block, written as code-point escapes: the
    // census counter that must read 0 counts literal characters, and the
    // test pinning the rule should not be the one thing that trips it.
    expect(node.textContent).not.toMatch(/[\u0660-\u0669]/);
  });

  it("honours each precision", () => {
    const { rerender } = render(
      <DateTime value={TIMESTAMP} language="en" timeZone="UTC" precision="datetime" />,
    );
    // ICU separates the time from AM/PM with a narrow no-break space in newer
    // versions and a plain space in older ones, so match on \s rather than
    // pinning one of them.
    expect(screen.getByText(/^Mar 15, 2026,\s9:30\sAM$/)).toBeInTheDocument();

    rerender(<DateTime value={TIMESTAMP} language="en" timeZone="UTC" precision="time" />);
    expect(screen.getByText(/^9:30\sAM$/)).toBeInTheDocument();
  });

  it("respects an explicit IANA zone", () => {
    render(<DateTime value={TIMESTAMP} language="en" timeZone="Asia/Tokyo" precision="time" />);
    expect(screen.getByText(/^6:30\sPM$/)).toBeInTheDocument();
  });

  it("takes tabular figures", () => {
    render(<DateTime value={TIMESTAMP} language="en" timeZone="UTC" precision="date" />);
    expect(screen.getByText("Mar 15, 2026").className).toContain("tabular-nums");
  });

  it("renders an unparseable timestamp verbatim and drops the <time> wrapper", () => {
    const { container } = render(<DateTime value="not-a-date" language="en" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
    // A dateTime attribute the parser rejected is not a machine-readable value.
    expect(container.querySelector("time")).toBeNull();
  });
});
