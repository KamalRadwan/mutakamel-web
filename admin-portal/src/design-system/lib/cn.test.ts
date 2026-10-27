import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps badge size and KPI text color together", () => {
    expect(cn("text-badge", "text-kpi-new-text")).toBe("text-badge text-kpi-new-text");
  });

  it("keeps tab size independent of nav color utilities", () => {
    for (const color of ["text-nav", "text-nav-foreground", "text-nav-foreground-strong", "text-nav-switcher-fg"]) {
      expect(cn("text-tab", color)).toBe(`text-tab ${color}`);
      expect(cn(color, "text-tab")).toBe(`${color} text-tab`);
    }
    expect(cn("text-foreground", "text-nav")).toBe("text-nav");
    expect(cn("text-nav", "text-foreground")).toBe("text-foreground");
  });

  it("lets badge size replace a default text size", () => {
    expect(cn("text-sm", "text-badge")).toBe("text-badge");
  });

  it("lets card radius replace a default radius", () => {
    expect(cn("rounded-md", "rounded-card")).toBe("rounded-card");
  });

  it("lets card shadow replace a default shadow", () => {
    expect(cn("shadow-sm", "shadow-card")).toBe("shadow-card");
  });

  it("keeps background color and gradient together", () => {
    expect(cn("bg-card", "bg-gradient-primary")).toBe("bg-card bg-gradient-primary");
  });

  it.each(["2xs", "micro", "badge", "caption", "label", "tab", "card-title", "column-title"])(
    "merges text-%s as a size independently of color in either order",
    (step) => {
      const size = `text-${step}`;
      expect(cn(size, "text-foreground")).toBe(`${size} text-foreground`);
      expect(cn("text-foreground", size)).toBe(`text-foreground ${size}`);
      expect(cn("text-sm", size)).toBe(size);
      expect(cn(size, "text-sm")).toBe("text-sm");
    },
  );

  it.each(["card", "column"])("merges rounded-%s with default and directional radii", (step) => {
    expect(cn("rounded-md", `rounded-${step}`)).toBe(`rounded-${step}`);
    expect(cn(`rounded-${step}`, "rounded-md")).toBe("rounded-md");
    expect(cn("rounded-s-md", `rounded-s-${step}`)).toBe(`rounded-s-${step}`);
    expect(cn(`rounded-s-${step}`, "rounded-md")).toBe("rounded-md");
  });

  it.each(["pop", "overlay", "toolbar", "column", "card", "nav-active"])(
    "merges shadow-%s independently of shadow color",
    (step) => {
      const shadow = `shadow-${step}`;
      expect(cn("shadow-sm", shadow)).toBe(shadow);
      expect(cn(shadow, "shadow-sm")).toBe("shadow-sm");
      expect(cn(shadow, "shadow-brand-600")).toBe(`${shadow} shadow-brand-600`);
    },
  );

  it.each(["header", "brand-strip", "primary", "avatar", "logo", "canvas", "chip-active"])(
    "merges bg-gradient-%s as a background image in either order",
    (step) => {
      const gradient = `bg-gradient-${step}`;
      expect(cn("bg-card", gradient)).toBe(`bg-card ${gradient}`);
      expect(cn(gradient, "bg-card")).toBe(`${gradient} bg-card`);
      expect(cn("bg-none", gradient)).toBe(gradient);
      expect(cn(gradient, "bg-none")).toBe("bg-none");
    },
  );

  it("replaces a named gradient with another named gradient", () => {
    expect(cn("bg-gradient-primary", "bg-gradient-avatar")).toBe("bg-gradient-avatar");
  });

  it("resolves sizes within matching modifiers and preserves other states", () => {
    expect(cn("text-caption", "hover:text-sm", "hover:text-badge", "hover:text-kpi-new-text"))
      .toBe("text-caption hover:text-badge hover:text-kpi-new-text");
  });

  it("preserves clsx input composition and default utility conflicts", () => {
    expect(cn("p-2", ["p-4", false], { "font-semibold": true, hidden: false }, null))
      .toBe("p-4 font-semibold");
  });
});
