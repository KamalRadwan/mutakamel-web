// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { useInventoryReferences } from "../hooks/useInventoryReferences";
import { AvailabilitySnapshot } from "./AvailabilitySnapshot";

let language: "en" | "ar" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language }) }));
afterEach(cleanup);
const id = "01902001-3000-7000-8000-000000000001";
const references = {
  itemLabel: () => "USB-C Cable · CAB-01", nodeLabel: () => "Cairo Warehouse", uomLabel: () => "Piece",
} as unknown as ReturnType<typeof useInventoryReferences>;

describe.each(["en", "ar"] as const)("availability snapshot (%s)", (lang) => {
  it("uses the negative outcome tone for a signed negative available quantity", () => {
    language = lang;
    render(<AvailabilitySnapshot references={references}
      query={{ nodeId: id, itemId: id, uomId: id, lotKey: "", serialKey: "" }}
      snapshot={{ nodeId: id, itemId: id, uomId: id, onHandQuantity: "1", reservedQuantity: "2", availableQuantity: "-1", version: 3, asOf: "2026-11-03T08:42:00Z", advisory: true }} />);
    const available = screen.getByText(dictionaries[lang].tradeInventory.available).parentElement;
    expect(available).toHaveClass("bg-destructive/10");
    expect(available).not.toHaveClass("bg-success-subtle/40");
    expect(available?.textContent).toMatch(/[-−]/u);
  });
  it.each(["light", "dark"])("shows named exact quantities and localized actions in %s", (theme) => {
    language = lang;
    const refresh = vi.fn();
    const inspect = vi.fn();
    const { container } = render(<div className={theme} dir={lang === "ar" ? "rtl" : "ltr"}>
      <AvailabilitySnapshot references={references} onRefresh={refresh} onInspect={inspect}
        query={{ nodeId: id, itemId: id, uomId: id, lotKey: "", serialKey: "" }}
        snapshot={{ nodeId: id, itemId: id, uomId: id, onHandQuantity: "12.00000001", reservedQuantity: "2", availableQuantity: "10.00000001", version: 3, asOf: "2026-11-03T08:42:00Z", advisory: true }} />
    </div>);
    expect(screen.getByRole("heading", { name: "USB-C Cable · CAB-01" })).toBeInTheDocument();
    expect(screen.getByText("Cairo Warehouse")).toBeInTheDocument();
    expect(screen.getByText("10.00000001")).toBeInTheDocument();
    expect(container.textContent).not.toContain(id);
    expect(screen.getByText(dictionaries[lang].tradeInventory.availabilityAdvisory)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].tradeInventory.refreshSnapshot }));
    fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].tradeInventory.viewSnapshot }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(inspect).toHaveBeenCalledOnce();
  });
});
