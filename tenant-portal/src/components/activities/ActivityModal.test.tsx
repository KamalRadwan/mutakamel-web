// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import type { Activity, ActivityTargetSelection } from "./activity-contract";
import { ActivityModal } from "./ActivityModal";

const mockReadCoreData = vi.fn();
const mockRunIdempotentWrite = vi.fn();

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "01950000-0000-7000-8000-000000000010",
      isTenantOwner: true,
      permissions: [
        "activities.read",
        "activities.read.all",
        "activities.create",
        "activities.update",
        "activities.update.all",
        "activities.complete",
        "activities.complete.all",
        "activities.cancel",
        "activities.cancel.all",
        "activities.assign",
      ],
    },
  }),
}));

vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ canMutate: true, mode: "FULL" }),
}));

vi.mock("@/design-system", async () => {
  const actual = await vi.importActual<typeof import("@/design-system")>("@/design-system");
  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: (...args: unknown[]) => mockReadCoreData(...args),
}));

vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: () => ({ idempotencyKey: "01950000-0000-7000-8000-000000000099" }),
  runIdempotentWrite: (...args: unknown[]) => mockRunIdempotentWrite(...args),
}));

const sampleTarget: ActivityTargetSelection = {
  app: "CRM",
  type: "LEAD",
  id: "01950000-0000-7000-8000-000000000001",
  label: "Acme Industrial Co.",
};

const sampleActivity: Activity = {
  id: "01950000-0000-7000-8000-000000000050",
  type: "MEETING",
  subject: "Architecture review & ERP walkthrough",
  description: "Prepare technical demo environment.",
  direction: null,
  priority: "HIGH",
  status: "PLANNED",
  dueAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  endsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  location: "Riyadh HQ · Floor 4",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  completedAt: null,
  cancelledAt: null,
  outcome: null,
  assigneeUserId: "01950000-0000-7000-8000-000000000010",
  assigneeName: "Kamal Radwan",
  createdByUserId: "01950000-0000-7000-8000-000000000010",
  createdByName: "Kamal Radwan",
  branchId: "01950000-0000-7000-8000-000000000002",
  companyId: "01950000-0000-7000-8000-000000000003",
  version: 3,
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T10:00:00.000Z",
  targets: [
    {
      id: "01950000-0000-7000-8000-000000000070",
      role: "PRIMARY",
      targetApp: "CRM",
      targetType: "LEAD",
      targetId: sampleTarget.id,
      label: sampleTarget.label,
      unavailableAt: null,
    },
  ],
};

beforeEach(() => {
  mockReadCoreData.mockReset();
  mockRunIdempotentWrite.mockReset();
});

afterEach(cleanup);

describe("ActivityModal Split-Workspace (Current · New · Edit)", () => {
  it("renders empty Current rail with quick starters and switches activity types in New mode", async () => {
    mockReadCoreData.mockImplementation((path: string) => {
      if (path.includes("/assignees")) {
        return Promise.resolve([{ id: "01950000-0000-7000-8000-000000000010", displayName: "Kamal Radwan" }]);
      }
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    render(
      <TooltipProvider>
        <ActivityModal
          request={{ kind: "create", target: sampleTarget, agenda: true }}
          scope="CRM"
          onClose={vi.fn()}
          onChanged={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(await screen.findByText(en.activities.agenda.empty)).toBeInTheDocument();
    expect(screen.getByText(en.activities.header.subtitleEmpty)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.sectionScheduleNew)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.requiredFieldsNote)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.traitSummaryTask)).toBeInTheDocument();
    expect(screen.getByText(en.activities.dueStates.OVERDUE)).toBeInTheDocument();
    expect(screen.getByText(en.activities.dueStates.TODAY)).toBeInTheDocument();
    expect(screen.getByText(en.activities.dueStates.UPCOMING)).toBeInTheDocument();

    // Quick-starter button in the empty rail switches the form to Meeting
    fireEvent.click(screen.getByRole("button", { name: `+ ${en.activities.types.MEETING}` }));
    expect(screen.getByText(en.activities.form.meetingDetails)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.traitSummaryMeeting)).toBeInTheDocument();

    // Typing a valid meeting link displays the live Valid link badge
    const urlInput = screen.getByPlaceholderText(en.activities.form.meetingUrlPlaceholder);
    fireEvent.change(urlInput, { target: { value: "https://meet.google.com/xyz-uvwx-rst" } });
    expect(screen.getByText(en.activities.form.validUrl)).toBeInTheDocument();
  });

  it("navigates seamlessly between Current Inspector, Edit mode with diff badges, and Complete dialog with quick templates", async () => {
    mockReadCoreData.mockImplementation((path: string) => {
      if (path.includes("/assignees")) {
        return Promise.resolve([{ id: "01950000-0000-7000-8000-000000000010", displayName: "Kamal Radwan" }]);
      }
      if (path.endsWith(`/${sampleActivity.id}`)) {
        return Promise.resolve(sampleActivity);
      }
      return Promise.resolve({
        items: [sampleActivity],
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    render(
      <TooltipProvider>
        <ActivityModal
          request={{ kind: "create", target: sampleTarget, agenda: true }}
          scope="CRM"
          onClose={vi.fn()}
          onChanged={vi.fn()}
        />
      </TooltipProvider>,
    );

    // Wait for populated card in the Left Rail
    const cardSubject = await screen.findByText(sampleActivity.subject);
    expect(cardSubject).toBeInTheDocument();

    // Click the card to open Current Activity Inspector
    fireEvent.click(cardSubject);
    expect(await screen.findByText(en.activities.detail.joinMeeting)).toBeInTheDocument();
    expect(screen.getByText(sampleActivity.location!)).toBeInTheDocument();
    expect(screen.getByText(en.activities.detail.optimisticLock)).toBeInTheDocument();
    expect(screen.getByText(`v${sampleActivity.version}`)).toBeInTheDocument();

    // Switch to Edit mode via the header mode switcher
    fireEvent.click(screen.getAllByRole("button", { name: en.activities.modes.edit })[0]);
    expect(await screen.findByText(en.activities.form.lockedTarget)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.traitEditNotice)).toBeInTheDocument();
    expect(screen.getByText(en.activities.form.editStatusHint)).toBeInTheDocument();

    // Modify the subject and verify Modified badge + unsaved counter
    const subjectInput = screen.getByDisplayValue(sampleActivity.subject);
    fireEvent.change(subjectInput, { target: { value: "Updated architecture review" } });
    expect(screen.getByText("1 unsaved")).toBeInTheDocument();
    expect(screen.getAllByText(en.activities.form.modified).length).toBeGreaterThan(0);

    // Trigger Complete dialog from the Left Rail card's quick action
    const doneButtons = screen.getAllByRole("button", { name: en.activities.actions.markDone });
    fireEvent.click(doneButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(en.activities.complete.title)).toBeInTheDocument();
    });
    expect(screen.getByText(en.activities.complete.footerNote)).toBeInTheDocument();

    // Click a quick outcome template pill inside the Complete dialog
    const templateText = en.activities.complete.templates.completedSuccessfully;
    fireEvent.click(screen.getByRole("button", { name: templateText }));
    expect(screen.getByDisplayValue(templateText)).toBeInTheDocument();
  });

  it("supports New Completed Call with Target Picker, Direction pills, and Completion Outcome subcard", async () => {
    mockReadCoreData.mockImplementation((path: string) => {
      if (path.includes("/targets")) {
        return Promise.resolve([
          {
            targetApp: "CRM",
            targetType: "CUSTOMER_PROFILE",
            targetId: "01950000-0000-7000-8000-000000000009",
            label: "Noor Logistics LLC",
          },
        ]);
      }
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    render(
      <ActivityModal
        request={{ kind: "create", defaults: { type: "CALL" } }}
        scope="ALL"
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    // Target picker is visible with colorful entity pills
    expect(screen.getByText(en.activities.form.relatedTo)).toBeInTheDocument();
    expect(screen.getAllByText(en.activities.targetTypes.CUSTOMER_PROFILE).length).toBeGreaterThan(0);

    // Call Direction segmented pills are rendered
    expect(screen.getByText(en.activities.directions.INBOUND)).toBeInTheDocument();
    expect(screen.getByText(en.activities.directions.OUTBOUND)).toBeInTheDocument();

    // Selecting Completed status reveals the Completion Outcome subcard
    fireEvent.click(screen.getByRole("radio", { name: en.activities.statuses.DONE }));
    expect(screen.getByPlaceholderText(en.activities.form.outcomePlaceholder)).toBeInTheDocument();
  });

  it("validates required fields before submit and supports Cancel dialog quick reason templates", async () => {
    mockReadCoreData.mockResolvedValue({
      items: [sampleActivity],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    render(
      <ActivityModal
        request={{ kind: "create", target: sampleTarget, agenda: true }}
        scope="CRM"
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await screen.findByText(sampleActivity.subject);

    // Submitting with blank subject reveals required validation error
    fireEvent.click(screen.getByRole("button", { name: en.activities.form.submitCreate }));
    expect(await screen.findByText(en.activities.validation.required)).toBeInTheDocument();
    expect(mockRunIdempotentWrite).not.toHaveBeenCalled();

    // Clicking Cancel on the card opens the Cancel dialog with quick reason templates
    const cancelButtons = screen.getAllByRole("button", { name: en.activities.actions.cancelActivity });
    fireEvent.click(cancelButtons[0]);

    expect(await screen.findByText(en.activities.cancel.title)).toBeInTheDocument();
    const cancelReason = en.activities.cancel.templates.rescheduled;
    fireEvent.click(screen.getByRole("button", { name: cancelReason }));
    expect(screen.getByDisplayValue(cancelReason)).toBeInTheDocument();
  });
});

