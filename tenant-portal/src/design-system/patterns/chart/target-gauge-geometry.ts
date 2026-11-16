export type TargetGaugeVariant = "semi" | "three-quarter" | "circle" | "speedometer" | "progress" | "bullet";

export function targetGaugeScale(value: number, target: number) {
  const min = Math.min(0, value);
  const max = Math.max(target, value);
  // Normalizing before subtraction keeps finite extreme coordinates finite.
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const span = max / scale - min / scale;
  const ratio = (number: number) => Math.max(0, Math.min(1, (number / scale - min / scale) / span));
  return { min, max, valueRatio: ratio(value), targetRatio: ratio(target), zeroRatio: ratio(0) };
}

export function gaugePoint(angle: number, radius = 84, cx = 160, cy = 108) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export function gaugeArc(start: number, sweep: number, radius = 84) {
  const from = gaugePoint(start, radius);
  const to = gaugePoint(start + sweep, radius);
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;
}
