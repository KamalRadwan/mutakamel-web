// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpportunityCardViewFooter,
  type OpportunityCardViewFooterLabels,
} from "./OpportunityCardViewFooter";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));

afterEach(cleanup);

const labels: OpportunityCardViewFooterLabels = {
  activity: "Activities — Overdue",
  owner: "Owner: 0192f3a0-0000-7000-8000-000000000010",
  group: "Importance",
  setStars: "Rate {count} of {max}",
  clear: "Clear importance",
  customer: "Customer: Global Tech LLC",
  expectedClose: "Expected close",
  salesperson: "Salesperson: Alice",
};

describe("OpportunityCardViewFooter", () => {
  it("renders customer link, expected close date, salesperson, and rating", () => {
    const onImportanceChange = vi.fn();
    const onOpenActivities = vi.fn();

    render(
      <OpportunityCardViewFooter
        customerProfileId="0192f3a0-0000-7000-8000-000000000003"
        customerDisplayName="Global Tech LLC"
        expectedCloseDate="2026-10-15T00:00:00Z"
        importance={2}
        onImportanceChange={onImportanceChange}
        activityState="OVERDUE"
        onOpenActivities={onOpenActivities}
        ownerUserId="0192f3a0-0000-7000-8000-000000000010"
        labels={labels}
      />,
    );

    expect(screen.getByText("Global Tech LLC")).toBeInTheDocument();
    expect(screen.getByText(/Expected close/)).toBeInTheDocument();
    expect(screen.getByText("Salesperson: Alice")).toBeInTheDocument();
  });

  it("triggers onOpenActivities when activity icon is clicked", () => {
    const onOpenActivities = vi.fn();
    render(
      <OpportunityCardViewFooter
        customerProfileId="0192f3a0-0000-7000-8000-000000000003"
        customerDisplayName="Global Tech LLC"
        importance={1}
        onImportanceChange={vi.fn()}
        activityState="NO_OPEN"
        onOpenActivities={onOpenActivities}
        labels={labels}
      />,
    );

    const activityBtn = screen.getByTitle("Activities — Overdue");
    fireEvent.click(activityBtn);
    expect(onOpenActivities).toHaveBeenCalledTimes(1);
  });
});
