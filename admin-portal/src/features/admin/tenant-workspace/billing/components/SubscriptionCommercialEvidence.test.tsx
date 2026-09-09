// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { commercialFixture } from "../model/subscription-commercial-fixtures";
import { SubscriptionCommercialEvidence } from "./SubscriptionCommercialEvidence";

afterEach(cleanup);
describe("Accepted commercial evidence", () => {
  it("keeps base allowance separate from addon seats and uses accepted amounts", () => {
    render(<SubscriptionCommercialEvidence value={commercialFixture()} lang="en" />);
    expect(screen.getByText("Base application seats only").nextElementSibling).toHaveTextContent("30");
    expect(screen.getByText("Combined recurring total").nextElementSibling).toHaveTextContent("USD 575.0000");
    expect(screen.getByText("Addons total").nextElementSibling).toHaveTextContent("USD 275.0000");
    expect(screen.getAllByText("Complete accepted-price evidence")).toHaveLength(2);
    expect(screen.getByText(/Operational use has not been evaluated/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(within(screen.getAllByRole("table")[1]).getByText("135.0000")).toBeInTheDocument();
    expect(screen.queryByText("60")).not.toBeInTheDocument();
  });
  it("supports Arabic labels and keeps accepted evidence independent of command controls", () => {
    render(<SubscriptionCommercialEvidence value={commercialFixture()} lang="ar" />);
    expect(screen.getByRole("heading", { name: "الأسعار المقبولة وإضافات الاشتراك" })).toBeInTheDocument();
    expect(screen.getByText("مقاعد التطبيقات الأساسية فقط").nextElementSibling).toHaveTextContent("30");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
