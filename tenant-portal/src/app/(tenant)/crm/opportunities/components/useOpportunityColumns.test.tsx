// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityStage } from "../hooks/pipeline-types";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import { useOpportunityColumns } from "./useOpportunityColumns";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

afterEach(cleanup);

const mockStage: OpportunityStage = {
  id: "0192f3a0-0000-7000-8000-000000000005",
  pipelineId: "0192f3a0-0000-7000-8000-000000000004",
  opportunityStageId: "0192f3a0-0000-7000-8000-000000000006",
  nameAr: "استكشاف",
  nameEn: "Discovery",
  flag: "DISCOVERY",
  category: "QUALIFICATION",
  rank: 1,
  isActive: true,
  isSystem: true,
};

const mockOpportunity: OpportunityListItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  customerProfileId: "0192f3a0-0000-7000-8000-000000000003",
  customerPartyId: "0192f3a0-0000-7000-8000-000000000012",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerEmail: "sales@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000011",
    displayName: "Nora Saleh",
    jobTitle: "Procurement Director",
    isPrimary: true,
    email: "nora@acme.example",
    phones: ["+201111111111"],
  },
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  pipelineId: "0192f3a0-0000-7000-8000-000000000004",
  stageId: "0192f3a0-0000-7000-8000-000000000005",
  stageFlag: "DISCOVERY",
  status: "IN_PROGRESS",
  title: "Enterprise Deal 2026",
  importance: 2,
  amount: "9007199254740991.25",
  currencyCode: "EGP",
  probabilityPercent: 65,
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  openActivityCount: 1,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  activityState: "FUTURE",
  tags: [
    {
      id: "0192f3a0-0000-7000-8000-000000000013",
      name: "VIP",
      color: null,
    },
  ],
  expectedCloseDate: "2026-11-30T00:00:00Z",
  createdAt: "2026-09-01T00:00:00Z",
};

describe("useOpportunityColumns", () => {
  it("defines the compact rich opportunity columns", () => {
    const stageById = new Map<string, OpportunityStage>([[mockStage.id, mockStage]]);
    const { result } = renderHook(() =>
      useOpportunityColumns({
        stageById,
        onDelete: vi.fn(),
      }),
    );

    const ids = result.current.map((col) => col.id);
    expect(ids).toContain("title");
    expect(ids).toContain("customer");
    expect(ids).toContain("contact");
    expect(ids).toContain("phone");
    expect(ids).toContain("country");
    expect(ids).toContain("stage");
    expect(ids).toContain("deal");
    expect(ids).toContain("source");
    expect(ids).toContain("owner");
    expect(ids).toContain("expectedClose");
    expect(ids).toContain("followUp");
    expect(ids).toContain("actions");
  });

  it("renders the exact deal amount with its probability", () => {
    const { result } = renderHook(() =>
      useOpportunityColumns({
        stageById: new Map([[mockStage.id, mockStage]]),
        onDelete: vi.fn(),
      }),
    );
    const dealColumn = result.current.find((column) => column.id === "deal");

    render(<div>{dealColumn!.cell(mockOpportunity)}</div>);

    expect(screen.getByText(/9,007,199,254,740,991\.25/)).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("keeps customer tags, contact details and city visible", () => {
    const { result } = renderHook(() =>
      useOpportunityColumns({
        stageById: new Map([[mockStage.id, mockStage]]),
        onDelete: vi.fn(),
      }),
    );
    const columns = new Map(result.current.map((column) => [column.id, column]));

    render(
      <div>
        {columns.get("customer")!.cell(mockOpportunity)}
        {columns.get("contact")!.cell(mockOpportunity)}
        {columns.get("country")!.cell(mockOpportunity)}
      </div>,
    );

    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Nora Saleh")).toBeInTheDocument();
    expect(screen.getByText(/Procurement Director.*nora@acme\.example/)).toBeInTheDocument();
    expect(screen.getByText("Cairo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acme Trading LLC/ })).toHaveAttribute(
      "href",
      `/crm/customer-profiles/${mockOpportunity.customerProfileId}`,
    );
  });

  it("renders followUp with CrmRating and activity button", () => {
    const stageById = new Map<string, OpportunityStage>([[mockStage.id, mockStage]]);
    const onOpenActivities = vi.fn();
    const onImportanceChange = vi.fn();

    const { result } = renderHook(() =>
      useOpportunityColumns({
        stageById,
        canUpdate: () => true,
        onDelete: vi.fn(),
        onImportanceChange,
        onOpenActivities,
        importances: { [mockOpportunity.id]: 3 },
      }),
    );

    const followUpCol = result.current.find((col) => col.id === "followUp");
    expect(followUpCol).toBeDefined();

    render(<div>{followUpCol!.cell(mockOpportunity)}</div>);

    const activityBtn = screen.getByTitle(/Activities/);
    fireEvent.click(activityBtn);
    expect(onOpenActivities).toHaveBeenCalledWith(mockOpportunity);
  });
});
