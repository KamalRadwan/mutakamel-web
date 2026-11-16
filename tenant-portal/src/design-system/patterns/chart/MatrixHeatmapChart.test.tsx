// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MatrixHeatmapChart } from "./MatrixHeatmapChart";
afterEach(cleanup);
it("keeps interactive zero cells keyboard-visible and distinguishes missing cells", () => {
  const selected = vi.fn(); render(<MatrixHeatmapChart columns={["08:00", "10:00"]} rows={["Fri"]} label="Activity" summary="Exact table" lowLabel="Low0" highLabel="High2" emptyLabel="—"
    cells={[[{ key: "zero", label: "Fri08:00", value: 0, formatted: "0", onSelect: selected }, { key: "missing", label: "Fri10:00", value: null, formatted: "—" }]]} />);
  expect(screen.getByRole("group", { name: "Activity" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Fri08:00: 0" })); expect(selected).toHaveBeenCalledOnce();
  expect(screen.getByTitle("Fri10:00: —")).toBeInTheDocument();
});
