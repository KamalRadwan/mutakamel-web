// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: i18n.lang }),
}));

import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("wraps full labels and descriptions instead of hiding them behind pointer-only truncation", () => {
    const label = "A complete operational metric label that must remain available";
    const description = "A complete explanation that remains readable with keyboard and zoom.";
    render(<StatCard label={label} value="Ready" description={description} />);

    expect(screen.getByText(label)).not.toHaveClass("truncate");
    expect(screen.getByText(label)).not.toHaveAttribute("title");
    expect(screen.getByText(description)).not.toHaveClass("truncate");
  });

  it("formats numeric values with Arabic locale-default digits", () => {
    i18n.lang = "ar";
    render(<StatCard label="الإجمالي" value={1234} />);
    expect(screen.getByText("١٬٢٣٤")).toBeInTheDocument();
    i18n.lang = "en";
  });
});
