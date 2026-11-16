// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DirectedGraphChart } from "./DirectedGraphChart";
import { IntervalChart } from "./IntervalChart";
afterEach(cleanup);
it("draws both directions and self-loops without an acyclic layout or invented node quantities", () => {
  const { container } = render(<DirectedGraphChart label="Transitions" summary="Exact counts" formatValue={String} nodes={[{ id: "a", label: "Qualified" }, { id: "b", label: "Proposal" }]}
    edges={[{ key: "ab", source: "a", target: "b", value: 5 }, { key: "ba", source: "b", target: "a", value: 2 }, { key: "aa", source: "a", target: "a", value: 1 }]} />);
  const edges = container.querySelectorAll("path[data-edge]"); expect(edges).toHaveLength(3);
  expect(edges[0].getAttribute("d")).not.toBe(edges[1].getAttribute("d"));
  expect(edges[2].getAttribute("d")).toContain(" C");
  expect(container.textContent).toContain("Proposal → Qualified: 2");
});
it("scales actual interval durations and retains a visible zero-duration event", () => {
  const { container } = render(<IntervalChart label="Intervals" summary="UTC" formatDate={String} data={[
    { key: "a", label: "Long", start: 0, end: 100 }, { key: "b", label: "Short", start: 50, end: 75 }, { key: "c", label: "Instant", start: 50, end: 50 },
  ]} />);
  const rects = container.querySelectorAll("rect"); expect(Number(rects[0].getAttribute("width"))).toBe(4 * Number(rects[1].getAttribute("width")));
  expect(rects[2].getAttribute("width")).toBe("1");
});
