// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { RegionalDistributionBarChart } from "./RegionalDistributionBarChart";
import { ServerCapacityChart } from "./ServerCapacityChart";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

describe("bounded dashboard charts", () => {
  it("bounds regional marks while retaining every region in exact values", () => {
    const regions = Array.from({ length: 20 }, (_, index) => ({
      key: `region-${index + 1}`,
      countryName: `Region ${index + 1}`,
      countryIsoCode: `R${index + 1}`,
      count: index + 1,
      ratio: (index + 1) / 210,
      tone: "blue" as const,
    }));

    render(
      <RegionalDistributionBarChart
        regions={regions}
        title="Regional capacity"
      />,
    );

    const figure = screen.getByRole("figure", { name: "Regional capacity" });
    expect(within(figure).getByText(/chart shows the first 12 regions/i)).toBeVisible();

    fireEvent.click(within(figure).getByText("Exact values"));
    const table = within(figure).getByRole("table", { name: "Regional capacity" });
    expect(within(table).getByText("Region 20")).toBeInTheDocument();
  });

  it("uses a bounded horizontal server chart while retaining every server in exact values", () => {
    const servers = Array.from({ length: 20 }, (_, index) => ({
      id: `server-${index + 1}`,
      name: `Server ${index + 1}`,
      currentTenants: index + 1,
      maxTenants: 50,
      utilization: (index + 1) / 50,
    }));

    render(
      <ServerCapacityChart servers={servers} title="Server capacity" />,
    );

    const figure = screen.getByRole("figure", { name: "Server capacity" });
    expect(within(figure).getByText(/chart shows the first 12 servers/i)).toBeVisible();

    fireEvent.click(within(figure).getByText("Exact values"));
    const table = within(figure).getByRole("table", { name: "Server capacity" });
    expect(within(table).getByText("Server 20")).toBeInTheDocument();
  });
});
