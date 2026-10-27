// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { OpportunityBulkActionsBar } from "./OpportunityBulkActionsBar";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(cleanup);

it("offers bulk importance with an accurate label and removes first-row shortcuts", () => {
  const onBulkSetImportance = vi.fn(async () => undefined);
  render(<OpportunityBulkActionsBar
    selectedIds={new Set(["first", "second"])} stages={[]} canUpdateAny
    deletableCount={0} isBulkDeleting={false}
    onBulkMoveStage={vi.fn(async () => undefined)} onBulkSetImportance={onBulkSetImportance}
    onBulkDelete={vi.fn()} onClearSelection={vi.fn()}
  />);
  const importance = screen.getByRole("combobox", { name: en.crmOpportunities.bulkSetImportance });
  fireEvent.change(importance, { target: { value: "3" } });
  expect(onBulkSetImportance).toHaveBeenCalledWith(3);
  expect(screen.queryByRole("button", { name: /Assign Salesperson|Importance & Tags|Schedule Follow-up/ })).toBeNull();
});
