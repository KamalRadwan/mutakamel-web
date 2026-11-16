import type { KeyboardEvent } from "react";

export function useDossierChoiceNavigation(values: readonly string[], value: string, onChange: (value: string) => void, disabled?: boolean) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || values.length === 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let step = 0;
    if (event.key === "ArrowDown") step = 1;
    if (event.key === "ArrowUp") step = -1;
    if (event.key === "ArrowRight") step = rtl ? -1 : 1;
    if (event.key === "ArrowLeft") step = rtl ? 1 : -1;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const current = Math.max(0, values.indexOf(value));
    const next = event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : (current + step + values.length) % values.length;
    onChange(values[next]);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
}
