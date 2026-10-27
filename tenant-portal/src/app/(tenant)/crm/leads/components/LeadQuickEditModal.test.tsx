// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import { CONTACT_DIRECTORY_PERMISSIONS, contactPersonPath } from "../[id]/contact-modal-contract";
import { leadPath } from "../lead-contract";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import type { CrmActionCapability } from "../../shared/crm-capabilities";
import { LeadQuickEditModal } from "./LeadQuickEditModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" };
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang, dir: directions[locale.lang] }),
}));

const directoryAccess = vi.hoisted(() => ({ allowed: true }));
const convertAccess = vi.hoisted(() => ({
  capability: { scope: "all", ownerUserIds: null } as CrmActionCapability | null,
  openModal: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["crm.leads.read", ...(directoryAccess.allowed ? CONTACT_DIRECTORY_PERMISSIONS : [])] } }),
}));

vi.mock("../../shared/components/CrmJobTitleField", () => ({
  CrmJobTitleField: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Contact Job Title" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
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

const customFieldRead = vi.hoisted(() => ({ loaded: true }));
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
          ownerId: "01950000-0000-7000-8000-000000000009",
          value: "120 Trucks",
        },
      },
    ],
    isLoading: false,
    valuesLoaded: customFieldRead.loaded,
    valuesError: customFieldRead.loaded ? null : { status: 500 },
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../hooks/useLeadCapabilities", () => ({
  useLeadCapabilities: () => ({
    capabilities: {
      update: { scope: "all", ownerUserIds: null },
      delete: { scope: "all", ownerUserIds: null },
      convert: convertAccess.capability,
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
      {
        id: "01950000-0000-7000-8000-000000000056",
        firstName: "Mona",
        lastName: "Hassan",
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
    openModal: convertAccess.openModal,
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
  RecordNotesSection: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="record-notes-section" data-read-only={String(readOnly)}>Notes Content</div>
  ),
}));

vi.mock("@/components/audit/RecordHistoryTab", () => ({
  RecordHistoryTab: () => <div data-testid="entity-history-card">Audit Log Content</div>,
}));
vi.mock("@/components/audit/hooks/useAuditAccess", () => ({ useAuditAccess: () => true }));

vi.mock("../../shared/components/RecordAttachmentsSection", () => ({
  RecordAttachmentsSection: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="record-attachments-section" data-read-only={String(readOnly)}>Files Content</div>
  ),
}));

const STAGES: readonly LeadStage[] = [
  { id: "01950000-0000-7000-8000-000000000001", nameAr: "جديد", nameEn: "New", flag: "NEW" },
  { id: "01950000-0000-7000-8000-000000000002", nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED" },
  { id: "01950000-0000-7000-8000-000000000003", nameAr: "قيد التأهيل", nameEn: "Qualifying", flag: "QUALIFYING" },
  { id: "01950000-0000-7000-8000-000000000004", nameAr: "مؤهل", nameEn: "Qualified", flag: "QUALIFIED" },
  { id: "01950000-0000-7000-8000-000000000005", nameAr: "رعاية", nameEn: "Nurturing", flag: "NURTURING" },
  { id: "01950000-0000-7000-8000-000000000006", nameAr: "معلق", nameEn: "On Hold", flag: "ON_HOLD" },
  { id: "01950000-0000-7000-8000-000000000007", nameAr: "غير مؤهل", nameEn: "Disqualified", flag: "DISQUALIFIED" },
  { id: "01950000-0000-7000-8000-000000000008", nameAr: "محول", nameEn: "Converted", flag: "CONVERTED" },
];

const CORPORATE_LEAD: LeadItem = {
  id: "01950000-0000-7000-8000-000000000009",
  partyId: "01950000-0000-7000-8000-000000000011",
  leadProfileType: "CORPORATE",
  leadName: "Al-Ahram Industrial Group",
  company: "Al-Ahram Industrial Group",
  email: "info@alahram-ind.eg",
  phone: "+201050049899",
  phones: ["+201050049899", "+20225789900"],
  country: "Egypt",
  city: "Cairo",
  primaryContact: {
    partyId: "01950000-0000-7000-8000-000000000013",
    displayName: "Eng. Tarek Mansour",
    jobTitle: "VP of Operations",
    email: "t.mansour@alahram-ind.eg",
    phones: ["+201005551234"],
    isPrimary: true,
  },
  sourceNameAr: "معرض القاهرة",
  sourceNameEn: "Cairo ICT Expo",
  sourceIconUrl: null,
  stageId: "01950000-0000-7000-8000-000000000004",
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
  id: "01950000-0000-7000-8000-000000000010",
  partyId: "01950000-0000-7000-8000-000000000012",
  leadProfileType: "INDIVIDUAL",
  leadName: "Dr. Hany El-Masry",
  firstName: "Hany",
  lastName: "El-Masry",
  company: "",
  email: "dr.hany@elmasry-clinic.eg",
  phone: "+201112223344",
  phones: ["+201112223344"],
  primaryContact: null,
  stageId: "01950000-0000-7000-8000-000000000003",
};

const CORPORATE_DETAIL = {
  ...CORPORATE_LEAD,
  branchId: "01950000-0000-7000-8000-000000000020",
  stageFlag: "QUALIFIED",
  status: "OPEN",
  displayName: CORPORATE_LEAD.leadName,
  companyName: CORPORATE_LEAD.company,
  companyEmail: CORPORATE_LEAD.email,
  contacts: [{ ...CORPORATE_LEAD.primaryContact }],
};

const INDIVIDUAL_DETAIL = {
  ...INDIVIDUAL_LEAD,
  branchId: CORPORATE_DETAIL.branchId,
  stageFlag: "QUALIFYING",
  status: "OPEN",
  displayName: INDIVIDUAL_LEAD.leadName,
  contacts: [],
};

function detailResponse(data: unknown): AxiosResponse<unknown> {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

beforeEach(() => {
  customFieldRead.loaded = true;
  locale.lang = "en";
  directoryAccess.allowed = true;
  convertAccess.capability = { scope: "all", ownerUserIds: null };
  convertAccess.openModal.mockClear();
  vi.spyOn(axiosClient, "get").mockResolvedValue(detailResponse(CORPORATE_DETAIL));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LeadQuickEditModal — Dossier 360° Redesign", () => {
  it.each(["en", "ar"] as const)("localizes section headings and color accessible names (%s)", async (lang) => {
    locale.lang = lang;
    renderQuickEdit();
    const copy = dictionaries[lang];
    expect(await screen.findByText(copy.crmLeads.executive.companyDetails)).toBeTruthy();
    expect(screen.getByRole("button", { name: `${copy.crmLeads.executive.cardColor}: ${copy.crmLeads.card.colors.GREEN}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `${copy.crmLeads.executive.cardColor}: ${copy.crmLeads.card.colorNone}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(copy.crmLeads.executive.editCompany) })).toBeTruthy();
  });

  it("renders Corporate Lead in clean View Mode without legacy subtitle or in-place edit text, and shows Company Details + Contact Persons", async () => {
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
        onSave={vi.fn().mockResolvedValue({ kind: "success" })}
      />,
    );

    await screen.findByText("Company Details");

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
    const onSave = vi.fn().mockResolvedValue({ kind: "success" });
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

    await screen.findByText("Company Details");

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

  it("shows a company email field error and does not report invalid input as saved", async () => {
    const onSave = vi.fn().mockResolvedValue({ kind: "success" });
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

    await screen.findByText("Company Details");
    fireEvent.click(screen.getByRole("button", { name: /Edit Company Details/i }));
    const emailInput = screen.getByLabelText("Company Email") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Company/i }));

    expect(await screen.findByText(en.crmLeads.create.errors.email)).toBeTruthy();
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(emailInput.value).toBe("abc");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Save Company/i })).toBeTruthy();
  });

  it("hides Company Details and Contact Persons completely when leadProfileType is INDIVIDUAL, showing Personal & Contact Information instead", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(detailResponse(INDIVIDUAL_DETAIL));
    const onSave = vi.fn().mockResolvedValue({ kind: "success" });
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

    await screen.findByText("Personal & Contact Information");

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
    const onSave = vi.fn().mockResolvedValue({ kind: "success" });
    const onMoveStage = vi.fn().mockResolvedValue({ kind: "success" });
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

    await screen.findByText("Company Details");

    // Click 3rd star at top header
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rate 3 of 3 stars" }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { rating: 3, expectedUpdatedAt: CORPORATE_DETAIL.updatedAt });

    // The localized color name still sends the same GREEN wire value.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `${en.crmLeads.executive.cardColor}: ${en.crmLeads.card.colors.GREEN}` }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { cardColor: "GREEN", expectedUpdatedAt: CORPORATE_DETAIL.updatedAt });

    // Click "No color" (first dot) at top header to clear card color
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `${en.crmLeads.executive.cardColor}: ${en.crmLeads.card.colorNone}` }));
    });
    expect(onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { cardColor: null, expectedUpdatedAt: CORPORATE_DETAIL.updatedAt });

    // Click "Nurturing" stage in the 8-stage pipeline bar
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Nurturing/i }));
    });
    expect(onMoveStage).toHaveBeenCalledWith(CORPORATE_LEAD, "01950000-0000-7000-8000-000000000005");
  });

  it("switches between Activities, Notes, Audit Log, and Files tabs in the Dossier Panel", async () => {
    render(
      <LeadQuickEditModal
        lead={CORPORATE_LEAD}
        leads={[CORPORATE_LEAD]}
        stages={STAGES}
        canUpdate={false}
        onClose={vi.fn()}
        onNavigateLead={vi.fn()}
        onMoveStage={vi.fn()}
        onOpenActivities={vi.fn()}
        onSave={vi.fn().mockResolvedValue({ kind: "success" })}
      />,
    );

    expect(await screen.findByText(/Next Scheduled Follow-Up/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Notes/i }));
    });
    expect(screen.getByTestId("record-notes-section")).toBeTruthy();
    expect(screen.getByTestId("record-notes-section").getAttribute("data-read-only")).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Audit Log|History/i }));
    });
    expect(screen.getByTestId("entity-history-card")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Files/i }));
    });
    expect(screen.getByTestId("record-attachments-section")).toBeTruthy();
    expect(screen.getByTestId("record-attachments-section").getAttribute("data-read-only")).toBe("false");
  });

  it("renders Converted Locked State banner and disables editing when stageFlag is CONVERTED", async () => {
    const convertedLead: LeadItem = {
      ...CORPORATE_LEAD,
      stageId: "01950000-0000-7000-8000-000000000008",
    };

    vi.mocked(axiosClient.get).mockResolvedValueOnce(detailResponse({
      ...CORPORATE_DETAIL,
      stageId: convertedLead.stageId,
      stageFlag: "CONVERTED",
      status: "CONVERTED",
    }));

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
      await screen.findByText(/Lead Successfully Converted to Customer/i),
    ).toBeTruthy();
    expect(screen.getAllByText(/Read-Only/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Edit Company Details/i })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Notes/i }));
    });
    expect(screen.getByTestId("record-notes-section").getAttribute("data-read-only")).toBe("true");
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Files/i }));
    });
    expect(screen.getByTestId("record-attachments-section").getAttribute("data-read-only")).toBe("true");
  });
});

function pendingDetail() {
  let resolve!: (response: AxiosResponse<unknown>) => void;
  const promise = new Promise<AxiosResponse<unknown>>((resolveResponse) => {
    resolve = resolveResponse;
  });
  return { promise, resolve };
}

function renderQuickEdit() {
  const props = {
    lead: CORPORATE_LEAD,
    leads: [CORPORATE_LEAD, INDIVIDUAL_LEAD],
    stages: STAGES,
    canUpdate: true,
    canDelete: true,
    onClose: vi.fn(),
    onNavigateLead: vi.fn(),
    onMoveStage: vi.fn().mockResolvedValue({ kind: "success" }),
    onOpenActivities: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ kind: "success" }),
    onDeleteLead: vi.fn(),
  };
  return { ...render(<LeadQuickEditModal {...props} />), props };
}

describe("LeadQuickEditModal owner assignment", () => {
  it("offers assignments without a clear action and sends the selected UUIDv7", async () => {
    const { props } = renderQuickEdit();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    const select = screen.getByRole("combobox", { name: "Salesperson (Owner)" }) as HTMLSelectElement;

    expect(select.value).toBe(CORPORATE_LEAD.ownerUserId);
    expect(Array.from(select.options).filter((option) => !option.disabled).every((option) => option.value !== "")).toBe(true);
    expect(Array.from(select.options).some((option) => option.text === "Unassigned")).toBe(false);

    const ownerUserId = "01950000-0000-7000-8000-000000000056";
    fireEvent.change(select, { target: { value: ownerUserId } });
    fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(
      CORPORATE_LEAD, expect.objectContaining({ ownerUserId }),
    ));
  });

  it.each([true, false])("omits custom fields on description-only edits (values loaded: %s)", async (loaded) => {
    customFieldRead.loaded = loaded;
    const { props } = renderQuickEdit();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    if (!loaded) expect(screen.queryByText("Expected Fleet Size")).toBeNull();
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "Updated notes" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { description: "Updated notes", expectedUpdatedAt: CORPORATE_DETAIL.updatedAt }));
  });

  it.each(["150 Trucks", "", "120 Trucks"])("submits only changed custom fields, including intentional clears: %s", async (value) => {
    const { props } = renderQuickEdit();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    fireEvent.change(screen.getByDisplayValue("120 Trucks"), { target: { value } });
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "Updated notes" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(CORPORATE_LEAD, {
      description: "Updated notes",
      expectedUpdatedAt: CORPORATE_DETAIL.updatedAt,
      ...(value === "120 Trucks" ? {} : { customFields: { expected_fleet_size: value } }),
    }));
  });

  it("omits an empty owner draft when saving another qualification field", async () => {
    const { props } = renderQuickEdit();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    // A stale or programmatically cleared draft must never turn into null on the wire.
    fireEvent.change(screen.getByRole("combobox", { name: "Salesperson (Owner)" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "Updated notes" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i }));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(
      CORPORATE_LEAD, expect.objectContaining({ description: "Updated notes" }),
    ));
    expect(props.onSave.mock.calls[0]?.[1]).not.toHaveProperty("ownerUserId");
  });
});

describe("LeadQuickEditModal convert admission", () => {
  it("uses the refreshed timestamp for a second save in the same modal", async () => {
    const updatedAt = "2026-10-26T10:00:00.124Z";
    vi.mocked(axiosClient.get)
      .mockResolvedValueOnce(detailResponse(CORPORATE_DETAIL))
      .mockResolvedValueOnce(detailResponse({ ...CORPORATE_DETAIL, description: "First save", updatedAt }));
    const { props } = renderQuickEdit();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "First save" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i })); });
    fireEvent.click(await screen.findByRole("button", { name: /Edit Qualification/i }));
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "Second save" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Save Qualification/i })); });
    expect(props.onSave).toHaveBeenLastCalledWith(CORPORATE_LEAD, { description: "Second save", expectedUpdatedAt: updatedAt });
  });

  it.each(["en", "ar"] as const)("shows a stale-save reload message in %s", async (language) => {
    locale.lang = language;
    const copy = dictionaries[language];
    const { props } = renderQuickEdit();
    props.onSave.mockResolvedValue({ kind: "failed", error: { status: 409, code: "CRM.LEAD.CONCURRENT_UPDATE" } });
    fireEvent.click(await screen.findByRole("button", { name: (name) => name.includes(copy.crmLeads.executive.editQualification) }));
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: (name) => name.includes(copy.crmLeads.executive.saveQualification) }));
    expect(await screen.findByText(copy.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"])).toBeTruthy();
    expect(props.onSave).toHaveBeenCalledWith(CORPORATE_LEAD, {
      description: "My draft", expectedUpdatedAt: CORPORATE_DETAIL.updatedAt,
    });
  });

  it.each([
    { label: "conversion is unavailable", capability: null },
    {
      label: "the owner is outside conversion scope",
      capability: {
        scope: "own" as const,
        ownerUserIds: ["01950000-0000-7000-8000-000000000099"],
      },
    },
  ])("hides Convert with update granted when $label", async ({ capability }) => {
    convertAccess.capability = capability;
    renderQuickEdit();

    expect(await screen.findByRole("button", { name: /Edit Company Details/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Convert Lead/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Convert Lead/i })).toBeNull();
    expect(convertAccess.openModal).not.toHaveBeenCalled();
  });

  it("opens conversion when the convert capability allows the lead owner", async () => {
    convertAccess.capability = {
      scope: "own",
      ownerUserIds: [CORPORATE_LEAD.ownerUserId!],
    };
    const { props } = renderQuickEdit();

    fireEvent.click(await screen.findByRole("button", { name: /Convert Lead/i }));

    expect(convertAccess.openModal).toHaveBeenCalledOnce();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

function expectOnlyRecoveryControls() {
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
    en.common.retry,
    en.common.close,
  ]);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByTestId("record-activities-panel")).toBeNull();
  expect(screen.queryByTestId("record-notes-section")).toBeNull();
  expect(screen.queryByTestId("record-attachments-section")).toBeNull();
}

describe("LeadQuickEditModal detail read boundary", () => {
  it("offers only close while detail is pending and enables edits after validation", async () => {
    const pending = pendingDetail();
    vi.mocked(axiosClient.get).mockReturnValueOnce(pending.promise);
    const { props } = renderQuickEdit();

    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      en.common.close,
    ]);
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    await act(async () => { pending.resolve(detailResponse(CORPORATE_DETAIL)); });
    expect(await screen.findByRole("button", { name: /Edit Company Details/i })).toBeTruthy();
    expect(axiosClient.get).toHaveBeenCalledWith(
      leadPath(CORPORATE_LEAD.id),
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it.each([403, 500, 0])("offers no writes after a %s failure and retries the detail read", async (status) => {
    const retry = pendingDetail();
    const error = status === 0
      ? new TypeError("Failed to fetch")
      : new TenantApiClientError("Detail read failed", {
          status,
          statusText: "Failed",
          headers: new Headers(),
          data: {},
        });
    vi.mocked(axiosClient.get).mockRejectedValueOnce(error).mockReturnValueOnce(retry.promise);
    const post = vi.spyOn(axiosClient, "post");
    const remove = vi.spyOn(axiosClient, "delete");
    const { props } = renderQuickEdit();

    await screen.findByRole("alert");
    expectOnlyRecoveryControls();
    expect(screen.getByText(status === 403 ? en.permissionGate.title : en.crmLeadDetail.loadFailed)).toBeTruthy();
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onMoveStage).not.toHaveBeenCalled();
    expect(props.onDeleteLead).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(screen.getByRole("status")).toBeTruthy();
    await act(async () => { retry.resolve(detailResponse(CORPORATE_DETAIL)); });
    expect(await screen.findByRole("button", { name: /Edit Company Details/i })).toBeTruthy();
    expect(axiosClient.get).toHaveBeenCalledTimes(2);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it.each([
    { name: "malformed", data: {} },
    { name: "different lead", data: { ...CORPORATE_DETAIL, id: INDIVIDUAL_LEAD.id } },
  ])("rejects a $name detail response and keeps retry available", async ({ data }) => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(detailResponse(data));
    const { props } = renderQuickEdit();

    await screen.findByText(en.crmLeadDetail.loadFailed);
    expectOnlyRecoveryControls();
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.common.close }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("removes the previous lead's editor while the next read is pending or fails", async () => {
    const pending = pendingDetail();
    const { rerender, props } = renderQuickEdit();
    await screen.findByRole("button", { name: /Edit Company Details/i });
    fireEvent.click(screen.getByRole("button", { name: /Edit Company Details/i }));
    vi.mocked(axiosClient.get).mockReturnValueOnce(pending.promise);

    rerender(<LeadQuickEditModal {...props} lead={INDIVIDUAL_LEAD} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Save Company/i })).toBeNull();

    await act(async () => { pending.resolve(detailResponse({})); });
    await screen.findByRole("alert");
    expectOnlyRecoveryControls();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("gates the existing editor when the selected branch changes", async () => {
    const pending = pendingDetail();
    const { rerender, props } = renderQuickEdit();
    await screen.findByRole("button", { name: /Edit Company Details/i });
    vi.mocked(axiosClient.get).mockReturnValueOnce(pending.promise);

    rerender(
      <LeadQuickEditModal
        {...props}
        branchId="01950000-0000-7000-8000-000000000021"
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit Company Details/i })).toBeNull();
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(props.onSave).not.toHaveBeenCalled();

    await act(async () => { pending.resolve(detailResponse({})); });
    await screen.findByRole("alert");
    expectOnlyRecoveryControls();
  });

  it("ignores a late detail response from a previous lead even if the transport resolves after abort", async () => {
    const previous = pendingDetail();
    vi.mocked(axiosClient.get)
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(detailResponse(INDIVIDUAL_DETAIL));
    const { rerender, props } = renderQuickEdit();
    const previousSignal = vi.mocked(axiosClient.get).mock.calls[0]?.[1]?.signal;

    rerender(<LeadQuickEditModal {...props} lead={INDIVIDUAL_LEAD} />);
    expect(await screen.findByText("Personal & Contact Information")).toBeTruthy();
    expect(previousSignal?.aborted).toBe(true);

    await act(async () => { previous.resolve(detailResponse(CORPORATE_DETAIL)); });
    expect(screen.getByText("Personal & Contact Information")).toBeTruthy();
    expect(screen.queryByText("Company Details")).toBeNull();
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

const CONTACT = {
  partyId: "01950000-0000-7000-8000-000000000013",
  relationshipId: null,
  displayName: "Eng. Tarek Mansour",
  jobTitle: "VP of Operations",
  email: "t.mansour@alahram-ind.eg",
  phones: ["+201005551234"],
  isPrimary: true,
  firstName: "Tarek",
  lastName: "Mansour",
  honorificTitle: "Eng",
};
const CONTACT_DETAIL = { ...CORPORATE_DETAIL, contacts: [CONTACT] };
const PHONE_ID = "01950000-0000-7000-8000-000000000031";
const EMAIL_ID = "01950000-0000-7000-8000-000000000032";
const PERSON = {
  id: CONTACT.partyId,
  partyType: "PERSON",
  displayName: CONTACT.displayName,
  firstName: CONTACT.firstName,
  lastName: CONTACT.lastName,
  honorificTitle: CONTACT.honorificTitle,
  contactMethods: [
    { id: PHONE_ID, partyId: CONTACT.partyId, methodType: "MOBILE", value: CONTACT.phones[0], isPrimary: true, createdAt: CORPORATE_LEAD.createdAt },
    { id: EMAIL_ID, partyId: CONTACT.partyId, methodType: "EMAIL", value: CONTACT.email, isPrimary: true, createdAt: CORPORATE_LEAD.createdAt },
    { id: "01950000-0000-7000-8000-000000000033", partyId: CONTACT.partyId, methodType: "WHATSAPP", value: "+201009998888", isPrimary: false, createdAt: CORPORATE_LEAD.createdAt },
  ],
};

function coreResponse(data: unknown) {
  return detailResponse({ success: true, data });
}

function contactRead(saved?: () => unknown) {
  vi.mocked(axiosClient.get).mockImplementation(async (path) => (
    path === contactPersonPath(CONTACT.partyId)
      ? coreResponse(PERSON)
      : detailResponse(saved ? saved() : CONTACT_DETAIL)
  ));
}

async function editExistingContact() {
  await screen.findByText(CONTACT.displayName);
  fireEvent.click(screen.getByRole("button", { name: /Edit$/u }));
  return screen.getByLabelText("Contact Mobile 1");
}

function deniedContactWrite() {
  return new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} });
}

describe("LeadQuickEditModal contact save confirmation", () => {
  it("persists an existing person's name, email and phone through Core and displays the reloaded server values after reopening", async () => {
    let applied = false;
    const saved = { ...CONTACT_DETAIL, contacts: [{ ...CONTACT, displayName: "Server-confirmed contact", firstName: "Updated", email: "updated@example.com", phones: ["+201055501234"] }] };
    contactRead(() => applied ? saved : CONTACT_DETAIL);
    const patch = vi.spyOn(axiosClient, "patch").mockImplementation(async (path, body) => {
      applied = true;
      const value = body as { value?: string };
      return coreResponse(path === contactPersonPath(CONTACT.partyId)
        ? { id: CONTACT.partyId, partyType: "PERSON", displayName: "Updated Mansour" }
        : { id: path.split("/").at(-1), partyId: CONTACT.partyId, value: value.value });
    });
    const { props, unmount } = renderQuickEdit();
    const phone = await editExistingContact();
    fireEvent.change(screen.getByLabelText("First Name *"), { target: { value: "Updated" } });
    fireEvent.change(screen.getByLabelText("Contact Email"), { target: { value: "updated@example.com" } });
    fireEvent.change(phone, { target: { value: "1055501234" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));

    expect(await screen.findByText("Server-confirmed contact")).toBeTruthy();
    expect(patch).toHaveBeenCalledWith(contactPersonPath(CONTACT.partyId), { displayName: "Updated Mansour", firstName: "Updated" }, expect.any(Object));
    expect(patch).toHaveBeenCalledWith(`/api/tenant/core/v1/directory/contact-methods/${PHONE_ID}`, { value: "+201055501234" }, expect.any(Object));
    expect(patch).toHaveBeenCalledWith(`/api/tenant/core/v1/directory/contact-methods/${EMAIL_ID}`, { value: "updated@example.com" }, expect.any(Object));
    expect(patch).toHaveBeenCalledTimes(3);
    expect(props.onSave).not.toHaveBeenCalled();
    unmount();
    renderQuickEdit();
    expect(await screen.findByText("Server-confirmed contact")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call +201055501234" }).getAttribute("href")).toBe("tel:+201055501234");
  });

  it("keeps edit mode while readback is pending and ignores repeated Save shortcuts", async () => {
    const pending = pendingDetail();
    let applied = false;
    vi.mocked(axiosClient.get).mockImplementation(async (path) => {
      if (path === contactPersonPath(CONTACT.partyId)) return coreResponse(PERSON);
      return applied ? pending.promise : detailResponse(CONTACT_DETAIL);
    });
    const patch = vi.spyOn(axiosClient, "patch").mockImplementation(async () => {
      applied = true;
      return coreResponse({ id: PHONE_ID, partyId: CONTACT.partyId, value: "+201055501234" });
    });
    const { props } = renderQuickEdit();
    fireEvent.change(await editExistingContact(), { target: { value: "1055501234" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: /Save Contact/u }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Contact Mobile 1")).toBeTruthy();
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(detailResponse({ ...CONTACT_DETAIL, contacts: [{ ...CONTACT, phones: ["+201055501234"] }] })); });
    expect(await screen.findByText(CONTACT.displayName)).toBeTruthy();
    expect(screen.queryByLabelText("Contact Mobile 1")).toBeNull();
  });

  it("retains the contact draft when Core definitively rejects the write", async () => {
    contactRead();
    const patch = vi.spyOn(axiosClient, "patch").mockRejectedValue(deniedContactWrite());
    const { props } = renderQuickEdit();
    fireEvent.change(await editExistingContact(), { target: { value: "1055501234" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    expect(await screen.findByText(en.crmLeadDetail.saveFailed)).toBeTruthy();
    expect(screen.getByLabelText("Contact Mobile 1")).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledOnce();
  });

  it("rejects identity edits without Directory grants instead of submitting ignored CRM fields", async () => {
    directoryAccess.allowed = false;
    contactRead();
    const patch = vi.spyOn(axiosClient, "patch");
    const { props } = renderQuickEdit();
    fireEvent.change(await editExistingContact(), { target: { value: "1055501234" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    expect(await screen.findByText(en.crmLeadDetail.contactIdentityPermission)).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("saves relationship-only edits without Directory grants and preserves every current contact", async () => {
    directoryAccess.allowed = false;
    const other = { ...CONTACT, partyId: "01950000-0000-7000-8000-000000000040", displayName: "Another contact", isPrimary: false };
    const fresh = { ...CONTACT_DETAIL, contacts: [CONTACT, other] };
    contactRead(() => fresh);
    const patch = vi.spyOn(axiosClient, "patch").mockResolvedValue(detailResponse(fresh));
    renderQuickEdit();
    await screen.findByText(CONTACT.displayName);
    fireEvent.click(screen.getAllByRole("button", { name: /Edit$/u })[0]);
    fireEvent.change(screen.getByLabelText("Contact Job Title"), { target: { value: "Director" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    await waitFor(() => expect(screen.queryByLabelText("Contact Job Title")).toBeNull());
    expect(patch).toHaveBeenCalledWith(leadPath(CORPORATE_LEAD.id), { expectedUpdatedAt: CONTACT_DETAIL.updatedAt, contacts: [
      { contactPartyId: CONTACT.partyId, jobTitle: "Director", isPrimary: true },
      { contactPartyId: other.partyId, jobTitle: other.jobTitle, isPrimary: false },
    ] }, expect.any(Object));
    expect(patch).toHaveBeenCalledOnce();
    expect(vi.mocked(axiosClient.get).mock.calls.every(([path]) => path === leadPath(CORPORATE_LEAD.id))).toBe(true);
  });

  it("uses the server-assigned Party ID for a newly added contact", async () => {
    let applied = false;
    const added = { ...CONTACT, partyId: "01950000-0000-7000-8000-000000000044", displayName: "Mona", firstName: "Mona", lastName: "", isPrimary: false, phones: [] };
    const saved = { ...CONTACT_DETAIL, contacts: [CONTACT, added] };
    contactRead(() => applied ? saved : CONTACT_DETAIL);
    const patch = vi.spyOn(axiosClient, "patch").mockImplementation(async () => {
      applied = true;
      return detailResponse(saved);
    });
    renderQuickEdit();
    await screen.findByText(CONTACT.displayName);
    fireEvent.click(screen.getByRole("button", { name: /Add Contact Person/u }));
    fireEvent.change(screen.getByLabelText("First Name *"), { target: { value: "Mona" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    expect(await screen.findByText("Mona")).toBeTruthy();
    expect(patch).toHaveBeenCalledWith(leadPath(CORPORATE_LEAD.id), { expectedUpdatedAt: CONTACT_DETAIL.updatedAt, contacts: [
      { contactPartyId: CONTACT.partyId, jobTitle: CONTACT.jobTitle, isPrimary: true },
      { fullName: "Mona", firstName: "Mona", lastName: "", honorificTitle: "", jobTitle: "", email: undefined, phones: [], isPrimary: false },
    ] }, expect.any(Object));
    fireEvent.click(screen.getAllByRole("button", { name: /Edit$/u })[1]);
    fireEvent.change(screen.getByLabelText("First Name *"), { target: { value: "Mona Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledWith(contactPersonPath(added.partyId), expect.any(Object)));
    expect(patch).toHaveBeenCalledOnce();
  });

  it.each(["partial", "uncertain", "unreadable receipt", "failed readback"])("requires an explicit read after a %s and never replays the contact draft", async (failure) => {
    let applied = false;
    contactRead(() => failure === "failed readback" && applied ? {} : CONTACT_DETAIL);
    const patch = vi.spyOn(axiosClient, "patch").mockImplementation(async () => {
      if (failure === "partial" && applied) throw deniedContactWrite();
      if (failure === "uncertain") throw new TypeError("Network connection lost");
      applied = true;
      return coreResponse(failure === "unreadable receipt" ? {} : { id: CONTACT.partyId, partyType: "PERSON", displayName: "Updated Mansour" });
    });
    const { props } = renderQuickEdit();
    await editExistingContact();
    fireEvent.change(screen.getByLabelText("First Name *"), { target: { value: "Updated" } });
    if (failure === "partial") fireEvent.change(screen.getByLabelText("Contact Email"), { target: { value: "updated@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/u }));
    await screen.findByText(failure === "partial" ? en.permissionGate.title : en.crmLeadDetail.loadFailed);
    expectOnlyRecoveryControls();
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(props.onClose).not.toHaveBeenCalled();
    const count = patch.mock.calls.length;
    contactRead();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await screen.findByText(CONTACT.displayName);
    expect(screen.queryByLabelText("Contact Mobile 1")).toBeNull();
    expect(patch).toHaveBeenCalledTimes(count);
  });
});


describe("LeadQuickEditModal rejected writes", () => {
  const rejected = { kind: "failed", error: { status: 422 } };

  it.each([400, 403, 409, 422])("shows a %s save error inside the dialog and retains the draft", async (status) => {
    const { props } = renderQuickEdit();
    props.onSave.mockResolvedValue({ kind: "failed", error: { status } });
    fireEvent.click(await screen.findByRole("button", { name: /Edit Company Details/i }));
    const name = screen.getByDisplayValue(CORPORATE_LEAD.company);
    fireEvent.change(name, { target: { value: "Rejected company" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Company/i }));

    const alert = await screen.findByRole("alert");
    expect(screen.getByRole("dialog").contains(alert)).toBe(true);
    expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Rejected company")).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("restores the rating after 422 and allows a new attempt", async () => {
    const { props } = renderQuickEdit();
    props.onSave.mockResolvedValue(rejected);
    const star = await screen.findByRole("button", { name: "Rate 3 of 3 stars" });
    fireEvent.click(star);
    await screen.findByRole("alert");
    expect(star.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Rate 2 of 3 stars" }).getAttribute("aria-pressed")).toBe("true");
    props.onSave.mockResolvedValue({ kind: "success" });
    fireEvent.click(star);
    await waitFor(() => expect(star.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("restores the selected card colour after 422", async () => {
    const { props } = renderQuickEdit();
    props.onSave.mockResolvedValue(rejected);
    const selected = await screen.findByRole("button", { name: `${en.crmLeads.executive.cardColor}: ${en.crmLeads.card.colors.BLUE}` });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(selected);
    await screen.findByRole("alert");
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(props.onSave).toHaveBeenCalledWith(CORPORATE_LEAD, { cardColor: null, expectedUpdatedAt: CORPORATE_DETAIL.updatedAt });
  });

  it("restores the stage and its current marker after 422", async () => {
    const { props } = renderQuickEdit();
    props.onMoveStage.mockResolvedValue(rejected);
    await screen.findByRole("button", { name: /Qualified.*Current/i });
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /Qualified.*Current/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Contacted.*Current/i })).toBeNull();
  });

  it("keeps a successful stage move without reopening the detail loader", async () => {
    renderQuickEdit();
    await screen.findByRole("button", { name: /Qualified.*Current/i });
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    await waitFor(() => expect((screen.getByRole("button", { name: /Contacted.*Current/i }) as HTMLButtonElement).disabled).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
