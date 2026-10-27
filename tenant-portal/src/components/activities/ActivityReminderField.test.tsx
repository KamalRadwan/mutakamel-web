// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { Activity, ActivityTargetSelection } from "./activity-contract";
import { ActivityReminderField } from "./ActivityReminderField";
import { activityToForm, createActivityForm, withActivityStatus } from "./activity-form";
import { buildCreateActivityBody, validateActivityForm } from "./activity-form-rules";
import { useActivityFormState } from "./hooks/useActivityFormState";

let dictionary = en;
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);

const sampleTarget: ActivityTargetSelection = {
  app: "CRM",
  type: "LEAD",
  id: "01950000-0000-7000-8000-000000000001",
  label: "Acme Industrial Co.",
};

const sampleActivity: Activity = {
  id: "01950000-0000-7000-8000-000000000050",
  type: "TODO",
  subject: "Follow up on quotation",
  description: null,
  direction: null,
  priority: "NORMAL",
  status: "PLANNED",
  dueAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  reminderOffsetMinutes: null,
  reminderSentAt: null,
  endsAt: null,
  location: null,
  meetingUrl: null,
  completedAt: null,
  cancelledAt: null,
  outcome: null,
  assigneeUserId: "01950000-0000-7000-8000-000000000010",
  assigneeName: "Kamal Radwan",
  createdByUserId: "01950000-0000-7000-8000-000000000010",
  createdByName: "Kamal Radwan",
  branchId: "01950000-0000-7000-8000-000000000002",
  companyId: "01950000-0000-7000-8000-000000000003",
  version: 1,
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

function CreateForm() {
  const form = useActivityFormState(() => createActivityForm({}), { mode: "create" });
  return <ActivityReminderField form={form} disabled={false} />;
}

function EditForm({ activity }: { activity: Activity }) {
  const form = useActivityFormState(() => activityToForm(activity), {
    mode: "edit",
    activityStatus: activity.status,
  });
  return <ActivityReminderField form={form} disabled={false} />;
}

describe("ActivityReminderField", () => {
  it.each([en, ar])("defaults to 15 minutes on create without a hint and connects translated validation feedback", (copy) => {
    dictionary = copy;
    render(<CreateForm />);
    const field = screen.getByRole("spinbutton", { name: copy.activities.form.reminderOffsetMinutes });
    expect(field).toHaveValue(15);
    expect(field).not.toHaveAttribute("aria-describedby");
    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveValue(null);
    fireEvent.change(field, { target: { value: "-1" } });
    fireEvent.blur(field);
    expect(screen.getByText(copy.activities.validation.invalidReminderOffset)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves the stored reminder value when editing an existing activity", () => {
    dictionary = en;
    const { unmount } = render(<EditForm activity={sampleActivity} />);
    expect(screen.getByRole("spinbutton", { name: en.activities.form.reminderOffsetMinutes })).toHaveValue(null);
    unmount();

    render(<EditForm activity={{ ...sampleActivity, reminderOffsetMinutes: 45 }} />);
    expect(screen.getByRole("spinbutton", { name: en.activities.form.reminderOffsetMinutes })).toHaveValue(45);
  });

  it("omits reminderOffsetMinutes and passes validation when creating a DONE activity with the 15-minute default", () => {
    const planned = { ...createActivityForm({ target: sampleTarget }), subject: "Send proposal summary" };
    expect(planned.reminderOffsetMinutes).toBe("15");
    expect(validateActivityForm(planned, { mode: "create" })).toEqual({});
    expect(buildCreateActivityBody(planned).reminderOffsetMinutes).toBe(15);

    const done = withActivityStatus(planned, "DONE");
    expect(validateActivityForm(done, { mode: "create" })).toEqual({});
    const doneBody = buildCreateActivityBody(done);
    expect(doneBody.status).toBe("DONE");
    expect(doneBody).not.toHaveProperty("reminderOffsetMinutes");
  });
});
