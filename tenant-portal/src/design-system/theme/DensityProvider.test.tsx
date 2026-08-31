// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "../primitives/Button";
import { DENSITY_SCALE, DensityProvider, useDensity, type Density } from "./DensityProvider";

function Harness() {
  const { density, setDensity } = useDensity();
  return (
    <div>
      <output data-testid="current">{density}</output>
      {(["compact", "standard", "comfortable"] as Density[]).map((option) => (
        // The design system Button, not a hand-rolled element: the census
        // counts those in this directory and a test fixture is not a reason to
        // spend one. (It is a text scan, so naming the raw tag here would be
        // counted too — this comment used to trip the gate it describes.)
        <Button key={option} onClick={() => setDensity(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}

function inlineScale(): string {
  return document.documentElement.style.getPropertyValue("--ui-scale");
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--ui-scale");
});

describe("DensityProvider", () => {
  it("defaults to compact and writes no inline scale, leaving globals.css authoritative", () => {
    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    expect(screen.getByTestId("current")).toHaveTextContent("compact");
    // Not "0.9" — compact is the stylesheet's own value. Writing it back would
    // make the same number live in two places.
    expect(inlineScale()).toBe("");
  });

  it("applies standard and comfortable to the document element", () => {
    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "comfortable" }));
    expect(inlineScale()).toBe("1.1");
    expect(window.localStorage.getItem("tenant_density")).toBe("comfortable");

    fireEvent.click(screen.getByRole("button", { name: "standard" }));
    expect(inlineScale()).toBe("1");
  });

  it("clears both the inline scale and the stored value on the way back to compact", () => {
    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "comfortable" }));
    fireEvent.click(screen.getByRole("button", { name: "compact" }));

    expect(inlineScale()).toBe("");
    expect(window.localStorage.getItem("tenant_density")).toBeNull();
  });

  it("restores a stored preference on mount", () => {
    window.localStorage.setItem("tenant_density", "comfortable");

    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    expect(screen.getByTestId("current")).toHaveTextContent("comfortable");
    expect(inlineScale()).toBe("1.1");
  });

  it("ignores a corrupt stored value rather than writing it to the document", () => {
    window.localStorage.setItem("tenant_density", "enormous");

    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    expect(screen.getByTestId("current")).toHaveTextContent("compact");
    expect(inlineScale()).toBe("");
  });

  it("follows a change made in another tab", () => {
    render(
      <DensityProvider>
        <Harness />
      </DensityProvider>,
    );

    act(() => {
      window.localStorage.setItem("tenant_density", "standard");
      window.dispatchEvent(new StorageEvent("storage", { key: "tenant_density" }));
    });

    expect(screen.getByTestId("current")).toHaveTextContent("standard");
    expect(inlineScale()).toBe("1");
  });
});

// The pre-hydration bootstrap in layout.tsx duplicates this provider's write,
// because a provider cannot run before the first paint. Duplication is the
// point; drift is the risk. D2 records a density change that shipped with
// every gate green and the effect inverted, so these two assert against the
// real file rather than against a copy of it.
describe("the bootstrap script and the provider agree", () => {
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

  it("uses the same storage key", () => {
    expect(layout).toContain('"tenant_density"');
  });

  it.each(Object.entries(DENSITY_SCALE))("writes %s as %s", (density, scale) => {
    expect(layout).toContain(`"${density}"`);
    expect(layout).toContain(`"--ui-scale","${scale}"`);
  });

  it("never writes the compact value, matching applyDensity's removeProperty path", () => {
    expect(layout).not.toContain('"--ui-scale","0.9"');
  });
});
