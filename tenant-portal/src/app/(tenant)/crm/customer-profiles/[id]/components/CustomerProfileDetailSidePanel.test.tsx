// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { CustomerProfileDetailSidePanel } from "./CustomerProfileDetailSidePanel";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  activities: vi.fn(),
  attachments: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/components/audit/EntityHistoryCard", () => ({
  EntityHistoryCard: (props: unknown) => {
    mocks.history(props);
    return <p>History content</p>;
  },
}));
vi.mock("@/components/activities/RecordActivitiesPanel", () => ({
  RecordActivitiesPanel: (props: unknown) => {
    mocks.activities(props);
    return <p>Activities content</p>;
  },
}));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({
  RecordAttachmentsSection: (props: unknown) => {
    mocks.attachments(props);
    return <input aria-label="Upload queue state" defaultValue="" />;
  },
}));

const CONTACT_ID = "0192f3a0-0000-7000-8000-000000000004";
const profile: CustomerProfileDetail = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  displayName: "Al-Amal Hospital",
  companyName: "Al-Amal Healthcare Co.",
  companyEmail: null,
  companyPhone: null,
  companyWebsite: null,
  email: null,
  primaryMobile: null,
  phones: [],
  address: null,
  contacts: [
    {
      partyId: CONTACT_ID,
      relationshipId: null,
      displayName: "Mona Saleh",
      firstName: "Mona",
      lastName: "Saleh",
      honorificTitle: null,
      jobTitle: null,
      isPrimary: true,
      email: null,
      phones: [],
    },
  ],
  taxNumber: null,
  commercialRegistrationNumber: null,
  legalName: null,
  description: null,
  ownerUserId: null,
  sourceLeadId: null,
  acquisitionSourceId: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-10T12:00:00Z",
};

const attached = {
  capabilities: {
    notesCreate: null,
    notesDelete: null,
    attachmentsCreate: null,
    attachmentsDelete: null,
  },
  error: null,
  isLoading: false,
};

function select(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Customer profile detail side panel", () => {
  it("matches the Lead rail and resolves contact parties in history", () => {
    render(
      <CustomerProfileDetailSidePanel
        profile={profile}
        attached={attached}
        readOnly={false}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Activities" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Attachments" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Notes" })).toBeNull();
    expect(mocks.history).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: "CustomerProfile",
        entityId: profile.id,
        relatedPartyIds: [profile.partyId, CONTACT_ID],
        refreshToken: profile,
      }),
    );
    expect(mocks.activities).not.toHaveBeenCalled();
    expect(mocks.attachments).not.toHaveBeenCalled();
  });

  it("keeps an opened attachment panel mounted while another tab is active", () => {
    render(
      <CustomerProfileDetailSidePanel
        profile={profile}
        attached={attached}
        readOnly
      />,
    );

    select("Attachments");
    const input = screen.getByRole("textbox", { name: "Upload queue state" });
    fireEvent.change(input, { target: { value: "Uploading contract.pdf" } });
    select("Activities");
    expect(input).not.toBeVisible();
    select("Attachments");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("Uploading contract.pdf");
    expect(mocks.attachments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        branchId: profile.branchId,
        sourceType: "CUSTOMER_PROFILE",
        sourceId: profile.id,
        readOnly: true,
        uploadVariant: "button",
        density: "compact",
      }),
    );
  });
});
