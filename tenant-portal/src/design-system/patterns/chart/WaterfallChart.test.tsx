// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WaterfallChart } from "./WaterfallChart";
afterEach(cleanup);
it("floats a negative change from the server cumulative balance and draws totals from zero", () => {
  const { container } = render(<WaterfallChart label="Balance" summary="Exact table" formatValue={String} steps={[
    { key: "s", label: "Opening", kind: "START", value: 100, cumulativeValue: 100 },
    { key: "d", label: "Decrease", kind: "DELTA", value: -40, cumulativeValue: 60 },
    { key: "t", label: "Closing", kind: "TOTAL", value: 60, cumulativeValue: 60 },
  ]} />);
  const delta = container.querySelector('[data-kind="DELTA"] rect'); const total = container.querySelector('[data-kind="TOTAL"] rect');
  expect(Number(delta?.getAttribute("y"))).toBeLessThan(Number(total?.getAttribute("y")));
  expect(Number(delta?.getAttribute("height"))).toBeLessThan(Number(total?.getAttribute("height")));
  expect(container.textContent).toContain("Decrease: -40 · 60");
});
