// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScatterPlotChart } from "./ScatterPlotChart";
vi.mock("recharts", () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return { ScatterChart: Slot, ResponsiveContainer: Slot, CartesianGrid: () => null, Cell: () => null, Tooltip: () => null,
    Scatter: ({ data }: { data: unknown }) => <div data-testid="points">{JSON.stringify(data)}</div>,
    XAxis: ({ dataKey, domain }: { dataKey: string; domain: unknown }) => <div data-testid="x" data-key={dataKey}>{JSON.stringify(domain)}</div>,
    YAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="y" data-key={dataKey} />,
    ZAxis: ({ dataKey, domain, range }: { dataKey: string; domain: unknown; range: unknown }) => <div data-testid="size" data-key={dataKey} data-range={JSON.stringify(range)}>{JSON.stringify(domain)}</div>,
  };
});
afterEach(cleanup);
describe("numeric XY and size rendering boundary", () => {
  it("keeps probability, amount and source age-size in their independent coordinates", () => {
    const points = [{ key: "opportunity", label: "Deal", x: 75, y: 50000, z: 30 }];
    render(<ScatterPlotChart points={points} bubble label="Deals" summary="One readable opportunity" xLabel="Probability" yLabel="Amount" sizeLabel="Capped age"
      xDomain={[0, 100]} sizeDomain={[0, 365]} formatX={String} formatY={String} formatSize={String} />);
    expect(JSON.parse(screen.getByTestId("points").textContent ?? "[]")).toEqual(points);
    expect(screen.getByTestId("x")).toHaveAttribute("data-key", "x");
    expect(screen.getByTestId("y")).toHaveAttribute("data-key", "y");
    expect(screen.getByTestId("size")).toHaveAttribute("data-key", "z");
    expect(screen.getByTestId("size")).toHaveTextContent("[0,365]");
    expect(screen.getByTestId("size")).toHaveAttribute("data-range", "[0,1600]");
  });
});
