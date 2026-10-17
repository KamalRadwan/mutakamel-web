// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { LeadQuickEditModal } from "./LeadQuickEditModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ canMutate: true }),
}));

vi.mock("../../shared/hooks/useCrmAcquisitionSources", () => ({
  useCrmAcquisitionSources: () => ({
    items: [
      {
        id: "01950000-0000-7000-8000-000000000099",
        nameAr: "معرض القاهرة",
        nameEn: "Cairo ICT Expo",
        iconUrl: null,
      },
    ],
  }),
}));

vi.mock("../../shared/hooks/useCrmCustomFieldValues", () => ({
  useCrmCustomFieldValues: () => ({
    entries: [
      {
        definition: {
          id: "01950000-0000-7000-8000-000000000088",
          ownerType: "LEAD",
          fieldKey: "expected_fleet_size",
          nameAr: "حجم الأسطول",
          nameEn: "Expected Fleet Size",
          type: "TEXT",
          options: [],
          isActive: true,
          sortOrder: 1,
        },
        value: {
          id: "01950000-0000-7000-8000-000000000089",
          fieldDefinitionId: "01950000-0000-7000-8000-000000000088",
          ownerType: "LEAD",
          ownerId: "lead-corp-1",
          value: "120 Trucks",
        },
      },
    ],
    isLoading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../hooks/useLeadCapabilities", () => ({
  useLeadCapabilities: () => ({
    capabilities: {
      update: { scope: "all", ownerUserIds: null },
      delete: { scope: "all", ownerUserIds: null },
      convert: { scope: "all", ownerUserIds: null },
      opportunitiesCreate: { scope: "all", ownerUserIds: null },
      notesCreate: { scope: "all", ownerUserIds: null },
      notesDelete: { scope: "all", ownerUserIds: null },
      attachmentsCreate: { scope: "all", ownerUserIds: null },
      attachmentsDelete: { scope: "all", ownerUserIds: null },
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../[id]/hooks/useLeadRelatedCounts", () => ({
  useLeadRelatedCounts: () => ({
    counts: { opportunities: 2, quotations: 3, salesOrders: 1, invoices: 1 },
    permitted: {
      opportunities: true,
      quotations: true,
      salesOrders: true,
      invoices: true,
    },
    isLoading: false,
  }),
}));

vi.mock("../[id]/hooks/useLeadDetailsReferences", () => ({
  useLeadDetailsReferences: () => ({
    actor: null,
    knownUsers: new Map(),
    ownerOptions: [
      {
        id: "01950000-0000-7000-8000-000000000055",
        firstName: "Karim",
        lastName: "Adel",
      },
    ],
    canReadUsers: true,
    usersLoading: false,
    usersUnavailable: false,
    tags: [],
    tagsLoading: false,
    tagsUnavailable: false,
  }),
}));

vi.mock("../[id]/hooks/useLeadConvert", () => ({
  useLeadConvert: () => ({
    open: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

vi.mock("../[id]/components/LeadConvertModal", () => ({
  LeadConvertModal: () => null,
}));

vi.mock("@/components/activities/RecordActivitiesPanel", () => ({
  RecordActivitiesPanel: () => <div data-testid="record-activities-panel" />,
}));

vi.mock("../../shared/components/RecordNotesSection", () => ({
  RecordNotesSection: () => <div data-testid="record-notes-section">Notes Content</div>,
}));

vi.mock("@/components/audit/EntityHistoryCard", () => ({
  EntityHistoryCard: () => <div data-testid="entity-history-card">Audit Log Content</div>,
}));

vi.mock("../../shared/components/RecordAttachmentsSection", () => ({
  RecordAttachmentsSection: () => (
    <div data-testid="record-attachments-section">Files Content</div>
  ),
}));

const STAGES: readonly LeadStage[] = [
  { id: "st-new", nameAr: "جديد", nameEn: "New", flag: "NEW" },
  { id: "st-contacted", nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED" },
  { id: "st-qualifying", nameAr: "قيد التأهيل", nameEn: "Qualifying", flag: "QUALIFYING" },
  { id: "st-qualified", nameAr: "مؤهل", nameEn: "Qualified", flag: "QUALIFIED" },
  { id: "st-nurturing", nameAr: "رعاية", nameEn: "Nurturing", flag: "NURTURING" },
  { id: "st-on-hold", nameAr: "معلق", nameEn: "On Hold", flag: "ON_HOLD" },
  { id: "st-disqualified", nameAr: "غير مؤهل", nameEn: "Disqualified", flag: "DISQUALIFIED" },
  { id: "st-converted", nameAr: "محول", nameEn: "Converted", flag: "CONVERTED" },
];

const CORPORATE_LEAD: LeadItem = {
  id: "lead-corp-1",
  partyId: "party-corp-1",
  leadProfileType: "CORPORATE",
  leadName: "Al-Ahram Industrial Group",
  company: "Al-Ahram Industrial Group",
  email: "info@alahram-ind.eg",
  phone: "+201050049899",
  phones: ["+201050049899", "+20225789900"],
  country: "Egypt",
  city: "Cairo",
  primaryContact: {
    partyId: "contact-party-1",
    displayName: "Eng. Tarek Mansour",
    jobTitle: "VP of Operations",
    email: "t.mansour@alahram-ind.eg",
    phones: ["+201005551234"],
    isPrimary: true,
  },
  primaryContactName: "Eng. Tarek Mansour",
  sourceNameAr: "معرض القاهرة",
  sourceNameEn: "Cairo ICT Expo",
  sourceIconUrl: null,
  stageId: "st-qualified",
  ownerUserId: "01950000-0000-7000-8000-000000000055",
  rating: 2,
  cardColor: "BLUE",
  owner: {
    userId: "01950000-0000-7000-8000-000000000055",
    firstName: "Karim",
    lastName: "Adel",
  },
  nextActivity: {
    activityAt: "2026-10-20T10:00:00.000Z",
    bucket: "FUTURE",
  },
  tags: [
    {
      id: "tag-1",
      name: "Enterprise ERP",
      backgroundColor: null,
      textColor: null,
    },
  ],
  taxNumber: "301-492-881-00",
  commercialRegistrationNumber: "CR-884120",
  companyWebsite: "https://alahram-ind.eg",
  interestSummary: "Multi-Branch ERP + Manufacturing",
  expectedNeed: "120 Users, Q4 Go-Live",
  description: "High-priority industrial group.",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-15T12:00:00.000Z",
};

const INDIVIDUAL_LEAD: LeadItem = {
  ...CORPORATE_LEAD,
  id: "lead-ind-1",
  partyId: "party-ind-1",
  leadProfileType: "INDIVIDUAL",
  leadName: "Dr. Hany El-Masry",
  firstName: "Hany",
  lastName: "El-Masry",
  company: "",
  email: "dr.hany@elmasry-clinic.eg",
  phone: "+201112223344",
  phones: ["+201112223344"],
  primaryContact: null,
  primaryContactName: "",
  stageId: "st-qualifying",
};

afterEach(() => {
  cleanup();
});

describe("LeadQuickEditModal — Dossier 360° Redesign", () => {
  it("renders Corporate Lead in clean View Mode without legacy subtitle or in-place edit text, and shows Company Details + Contact Persons", () => {
    render(
      <LeadQuickEditModal
        lead={CORPORATE_LEAD}
        leads={[CORPORATE_LEAD]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    // Legacy noisy strings must be completely gone
    expect(screen.queryByText(/Core Party #/i)).toBeNull();
    expect(screen.queryByText(/Centered Quick-Edit Modal/i)).toBeNull();
    expect(screen.queryByText(/Click any field to edit in-place/i)).toBeNull();

    // Corporate sections visible
    expect(screen.getByText("Company Details")).toBeTruthy();
    expect(screen.getByText(/Contact Persons \(1\)/i)).toBeTruthy();
    expect(screen.getByText("Eng. Tarek Mansour")).toBeTruthy();
    expect(screen.getByText("301-492-881-00")).toBeTruthy();
    expect(screen.getByText("CR-884120")).toBeTruthy();

    // Custom fields section rendered
    expect(screen.getByText("Expected Fleet Size")).toBeTruthy();
    expect(screen.getByText("120 Trucks")).toBeTruthy();
  });

  it("switches Company Details to Edit Mode with split country code + national number phone inputs and saves changes", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <LeadQuickEditModal
        lead={CORPORATE_LEAD}
        leads={[CORPORATE_LEAD]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={onSave}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Edit Company Details/i }));
    });

    expect(screen.getByText("Editing Company Details & Phones")).toBeTruthy();
    // Split phone input national number box should contain the national part without +20
    const phoneInput = screen.getByLabelText("Company Phone 1") as HTMLInputElement;
    expect(phoneInput.value).toBe("1050049899");

    // Change Company Name & Tax Number
    fireEvent.change(screen.getByLabelText("Company Name *"), {
      target: { value: "Al-Ahram Holdings" },
    });
    fireEvent.change(screen.getByLabelText("Tax Number"), {
      target: { value: "999-888-777" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Company/i }));
    });

    expect(onSave).toHaveBeenCalledWith(
      CORPORATE_LEAD,
      expect.objectContaining({
        companyName: "Al-Ahram Holdings",
        taxNumber: "999-888-777",
      }),
    );
  });

  it("hides Company Details and Contact Persons completely when leadProfileType is INDIVIDUAL, showing Personal & Contact Information instead", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <LeadQuickEditModal
        lead={INDIVIDUAL_LEAD}
        leads={[INDIVIDUAL_LEAD]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.queryByText("Company Details")).toBeNull();
    expect(screen.queryByText(/Contact Persons/i)).toBeNull();
    expect(screen.getByText("Personal & Contact Information")).toBeTruthy();
    expect(
      screen.getByText(/Personal Mobile Numbers \(phones\[\] — View Mode\)/i),
    ).toBeTruthy();

    // Enter Individual Edit Mode
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Edit Personal Info/i }));
    });

    expect(screen.getByText("Editing Personal & Contact Information")).toBeTruthy();
    const mobileInput = screen.getByLabelText("Personal Mobile 1") as HTMLInputElement;
    expect(mobileInput.value).toBe("1112223344");

    fireEvent.change(screen.getByLabelText("Honorific Title"), {
      target: { value: "Dr" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Personal Info/i }));
    });

    expect(onSave).toHaveBeenCalledWith(
      INDIVIDUAL_LEAD,
      expect.objectContaining({
        honorificTitle: "Dr",
      }),
    );
  });

  it("updates 3-Star rating, Card Color dots, and 8-Stage Pipeline Bar interactively", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onMoveStage = vi.fn().mockResolvedValue(undefined);
    render(
      <LeadQuickEditModal
        lead={CORPORATE_LEAD}
        leads={[CORPORATE_LEAD]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={onMoveStage}
        onOpenActivities={vi.fn()}
        onSave={onSave}
      />,
    );

    // Click 3rd star at top header
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rate 3 of 3 stars" }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { rating: 3 });

    // Click Emerald card color dot at top header
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Card color Emerald" }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { cardColor: "GREEN" });

    // Click "No color" (first dot) at top header to clear card color
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Card color None" }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { cardColor: null });

    // Click "Nurturing" stage in the 8-stage pipeline bar
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Nurturing/i }));
    });
    expect(onMoveStage).toHaveBeenCalledWith(CORPORATE_LEAD, "st-nurturing");
  });

  it("switches between Activities, Notes, Audit Log, and Files tabs in the Dossier Panel", async () => {
    render(
      <LeadQuickEditModal
        lead={CORPORATE_LEAD}
        leads={[CORPORATE_LEAD]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText(/Next Scheduled Follow-Up/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Notes/i }));
    });
    expect(screen.getByTestId("record-notes-section")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Audit Log/i }));
    });
    expect(screen.getByTestId("entity-history-card")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Files/i }));
    });
    expect(screen.getByTestId("record-attachments-section")).toBeTruthy();
  });

  it("renders Converted Locked State banner and disables editing when stageFlag is CONVERTED", () => {
    const convertedLead: LeadItem = {
      ...CORPORATE_LEAD,
      stageId: "st-converted",
    };

    render(
      <LeadQuickEditModal
        lead={convertedLead}
        leads={[convertedLead]}
        stages={STAGES}
        canUpdate={true}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Lead Successfully Converted to Customer/i),
    ).toBeTruthy();
    expect(screen.getAllByText(/Read-Only/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Edit Company Details/i })).toBeNull();
  });
});
