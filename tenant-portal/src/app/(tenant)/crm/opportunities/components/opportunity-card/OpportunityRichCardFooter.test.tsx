// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpportunityRichCardFooter } from "./OpportunityRichCardFooter";

afterEach(cleanup);

const labels = {
  activity: "2 open activities",
  ownerUnavailable: "Not provided",
  group: "Importance",
  setStars: "Set importance to {count} of {max}",
  clear: "Clear importance",
  quotations: "Quotations: 2",
  salesOrders: "Sales orders: 3",
  invoices: "Invoices: 4",
};

describe("Opportunity rich card footer", () => {
  it("keeps PQ, SO, IN, salesperson, rating, and activities in the bottom section", () => {
    const onOpenActivities = vi.fn();
    render(
      <OpportunityRichCardFooter
        importance={2}
        ownerDisplayName="Kamal Radwan"
        ownerAvatarUrl={null}
        openActivityCount={2}
        activityState="OVERDUE"
        counts={{ quotations: 2, salesOrders: 3, invoices: 4 }}
        countVisibility={{ quotations: true, salesOrders: true, invoices: true }}
        canUpdate
        onImportanceChange={vi.fn()}
        onOpenActivities={onOpenActivities}
        labels={labels}
      />,
    );

    expect(screen.getByText("PQ: 2")).toBeInTheDocument();
    expect(screen.getByText("SO: 3")).toBeInTheDocument();
    expect(screen.getByText("IN: 4")).toBeInTheDocument();
    expect(screen.getByText("Kamal Radwan")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: labels.group })).getAllByRole("button"))
      .toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: labels.activity }));
    expect(onOpenActivities).toHaveBeenCalledOnce();
  });

  it("does not expose document kinds the actor cannot read", () => {
    render(
      <OpportunityRichCardFooter
        importance={0}
        ownerDisplayName={null}
        ownerAvatarUrl={null}
        openActivityCount={0}
        activityState="NO_OPEN"
        counts={{ quotations: 2, salesOrders: 3, invoices: 4 }}
        countVisibility={{ quotations: true, salesOrders: false, invoices: false }}
        canUpdate={false}
        onImportanceChange={vi.fn()}
        onOpenActivities={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByText("PQ: 2")).toBeInTheDocument();
    expect(screen.queryByText("SO: 3")).not.toBeInTheDocument();
    expect(screen.queryByText("IN: 4")).not.toBeInTheDocument();
  });
});
