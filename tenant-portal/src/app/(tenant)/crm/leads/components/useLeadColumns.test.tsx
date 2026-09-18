// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { useLeadColumns } from "./useLeadColumns";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: en }),
}));

const lead: LeadItem = {
  id: "01900100-0000-7000-8000-000000000001",
  partyId: "01900100-0000-7000-8000-000000000002",
  leadProfileType: "CORPORATE",
  leadName: "Acme Company",
  company: "Acme Company",
  email: "hello@acme.example",
  phone: "+201000000000",
  phones: ["+201000000000"],
  country: "Egypt",
  primaryContact: {
    partyId: "01900100-0000-7000-8000-000000000003",
    displayName: "Nora Saleh",
    jobTitle: "Sales manager",
    email: "nora@acme.example",
    phones: ["01111111111"],
    isPrimary: true,
  },
  sourceNameAr: "إحالة",
  sourceNameEn: "Referral",
  sourceIconUrl: null,
  stageId: "01900100-0000-7000-8000-000000000004",
  ownerUserId: "01900100-0000-7000-8000-000000000005",
  rating: 1,
  cardColor: null,
  owner: {
    userId: "01900100-0000-7000-8000-000000000005",
    firstName: "Kamal",
    lastName: "Radwan",
  },
  nextActivity: null,
  primaryContactName: "Nora Saleh",
  tags: [],
};

const stage: LeadStage = {
  id: lead.stageId,
  nameAr: "جديد",
  nameEn: "New",
  flag: "NEW",
};

afterEach(cleanup);

function setup() {
  const onRatingChange = vi.fn();
  const onOpenActivities = vi.fn();
  const { result } = renderHook(() => useLeadColumns({
    stageById: new Map([[stage.id, stage]]),
    canUpdate: () => true,
    canDelete: () => true,
    onDelete: vi.fn(),
    onRatingChange,
    onOpenActivities,
  }));
  return { columns: result.current, onRatingChange, onOpenActivities };
}

describe("Leads table interactions", () => {
  it("opens the lead from each of the first three columns", () => {
    const { columns } = setup();
    render(
      <div>
        {columns.slice(0, 3).map((column) => <div key={column.id}>{column.cell(lead)}</div>)}
      </div>,
    );

    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === `/crm/leads/${lead.id}`);
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("href", `/crm/leads/${lead.id}`);
    }

    expect(screen.getByRole("link", { name: "Call 01111111111" })).toHaveAttribute(
      "href",
      "tel:01111111111",
    );
    expect(
      screen.getByRole("link", { name: "Message 01111111111 on WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/201111111111");
    expect(
      screen.getByRole("link", { name: "Message 01111111111 on Telegram" }),
    ).toHaveAttribute("href", "https://t.me/+201111111111");
  });

  it("changes rating and opens the activity modal through the follow-up column", () => {
    const { columns, onRatingChange, onOpenActivities } = setup();
    const followUp = columns.find((column) => column.id === "followUp")!;
    render(<div>{followUp.cell(lead)}</div>);

    fireEvent.click(screen.getByRole("button", { name: "Rate 3 of 3" }));
    expect(onRatingChange).toHaveBeenCalledWith(lead, 3);

    fireEvent.click(screen.getByRole("button", { name: "Activities — No open activity" }));
    expect(onOpenActivities).toHaveBeenCalledWith(lead);
  });
});
