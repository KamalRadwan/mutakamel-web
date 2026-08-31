// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabsContent } from "@/design-system";
import { DatabaseServerTabsNav } from "./DatabaseServerTabsNav";
import type { DatabaseServerTab } from "../hooks/useDatabaseServerDetailPage";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      databaseServerDetail: {
        tabs: {
          overview: "Overview",
          readiness: "Readiness",
          bindings: "Bindings",
          security: "Security",
          history: "History",
        },
      },
    },
  }),
}));

afterEach(cleanup);

function Harness() {
  const [activeTab, setActiveTab] = useState<DatabaseServerTab>("overview");

  return (
    <DatabaseServerTabsNav
      activeTab={activeTab}
      onTabChange={setActiveTab}
      bindingsCount={2}
      historyCount={3}
      bootstrapStatus="READY"
    >
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="readiness">Readiness panel</TabsContent>
      <TabsContent value="bindings">Bindings panel</TabsContent>
      <TabsContent value="security">Security panel</TabsContent>
      <TabsContent value="history">History panel</TabsContent>
    </DatabaseServerTabsNav>
  );
}

describe("DatabaseServerTabsNav", () => {
  it("links tabs to panels and supports Arrow, Home, and End keys", async () => {
    render(<Harness />);

    expect(screen.getByRole("tablist", { name: "Database server details" })).toBeInTheDocument();
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toHaveTextContent("Overview panel");

    fireEvent.keyDown(overview, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /Readiness/ })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("tabpanel", { name: /Readiness/ })).toHaveTextContent("Readiness panel");

    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true"));

    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true"));
  });
});
