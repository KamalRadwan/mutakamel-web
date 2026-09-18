// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityCardItem } from "../hooks/useOpportunityCards";
import { OpportunityCardTile } from "./OpportunityCardTile";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

const item: OpportunityCardItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  title: "Enterprise renewal",
  stageId: "0192f3a0-0000-7000-8000-000000000002",
  stageFlag: "PROPOSAL",
  status: "IN_PROGRESS",
  customerPartyId: "0192f3a0-0000-7000-8000-000000000003",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerEmail: "sales@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000004",
    displayName: "Nora Saleh",
    jobTitle: "Procurement Director",
    isPrimary: true,
    email: "nora@acme.example",
    phones: ["+201111111111"],
  },
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  ownerUserId: "0192f3a0-0000-7000-8000-000000000005",
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  importance: 2,
  amount: "9007199254740991.25",
  currencyCode: "EGP",
  probabilityPercent: 65,
  expectedCloseDate: "2026-10-31",
  openActivityCount: 1,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  activityState: "FUTURE",
  tags: [],
};

beforeEach(() => {
  localStorage.setItem("tenant_lang", "en");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("OpportunityCardTile", () => {
  it("renders the compact commercial summary without rounding the amount", () => {
    render(<OpportunityCardTile item={item} stageName="Proposal" />);

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/9,007,199,254,740,991\.25/)).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText(/Oct 31, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
  });

  it("keeps tags compact and summarizes the remaining count", () => {
    render(
      <OpportunityCardTile
        item={{
          ...item,
          tags: [
            { id: "0192f3a0-0000-7000-8000-000000000011", name: "VIP", color: null },
            { id: "0192f3a0-0000-7000-8000-000000000012", name: "Renewal", color: null },
            { id: "0192f3a0-0000-7000-8000-000000000013", name: "Enterprise", color: null },
            { id: "0192f3a0-0000-7000-8000-000000000014", name: "Hidden one", color: null },
            { id: "0192f3a0-0000-7000-8000-000000000015", name: "Hidden two", color: null },
          ],
        }}
      />,
    );

    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Renewal")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.queryByText("Hidden one")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden two")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
