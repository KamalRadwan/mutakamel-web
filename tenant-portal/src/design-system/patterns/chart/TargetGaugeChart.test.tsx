// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TargetGaugeChart, type TargetGaugeChartProps } from "./TargetGaugeChart";
import { targetGaugeScale } from "./target-gauge-geometry";
const props: TargetGaugeChartProps = { variant: "semi", value: 8, target: 10, label: "New leads", summary: "8 leads; target10", valueLabel: "8", targetLabel: "Target10", formatAxis: String };
afterEach(cleanup);
describe("actual value and target gauge geometries", () => {
  it.each(["semi", "three-quarter", "circle", "speedometer", "progress", "bullet"] as const)("uses the real target scale for %s, including goals below100", (variant) => {
    render(<TargetGaugeChart {...props} variant={variant} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "8; Target10");
  });
  it("distinguishes180,270,360and needle geometries", () => {
    const { container, rerender } = render(<TargetGaugeChart {...props} />);
    expect(container.querySelector('[data-arc-degrees="180"]')).not.toBeNull();
    rerender(<TargetGaugeChart {...props} variant="three-quarter" />);
    expect(container.querySelector('[data-arc-degrees="270"]')).not.toBeNull();
    expect(container.querySelector('[data-value-needle]')).toBeNull();
    rerender(<TargetGaugeChart {...props} variant="circle" />);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector('[data-arc-degrees]')).toBeNull();
    rerender(<TargetGaugeChart {...props} variant="speedometer" />);
    expect(container.querySelector('[data-value-needle]')).not.toBeNull();
    expect(container.querySelectorAll("g")).toHaveLength(6);
  });
  it("keeps over-target actual values and a separate goal marker", () => {
    const { container } = render(<TargetGaugeChart {...props} value={125} target={100} valueLabel="125" variant="circle" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "125");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "125");
    expect(container.querySelector('[data-target-marker]')).not.toBeNull();
    expect(targetGaugeScale(125, 100).targetRatio).toBe(0.8);
  });
  it("does not invent a default target or paint a nonzero arc for zero", () => {
    const { container, rerender } = render(<TargetGaugeChart {...props} value={0} variant="circle" />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    rerender(<TargetGaugeChart {...props} target={0} />);
    expect(screen.queryByRole("meter")).toBeNull();
  });
  it("keeps finite signed coordinates bounded even at extreme supported numeric magnitudes", () => {
    const scale = targetGaugeScale(-1e308, 1e308);
    expect(scale.valueRatio).toBe(0);
    expect(scale.targetRatio).toBe(1);
    expect(scale.zeroRatio).toBe(0.5);
  });
});
