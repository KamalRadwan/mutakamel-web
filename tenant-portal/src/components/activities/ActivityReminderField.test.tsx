// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { ActivityReminderField } from "./ActivityReminderField";
import { createActivityForm } from "./activity-form";
import { useActivityFormState } from "./hooks/useActivityFormState";

let dictionary = en;
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);

function Form() {
  const form = useActivityFormState(() => createActivityForm({}), { mode: "create" });
  return <ActivityReminderField form={form} disabled={false} />;
}

describe("ActivityReminderField", () => {
  it.each([en, ar])("labels the minutes field and connects its translated validation feedback", (copy) => {
    dictionary = copy;
    render(<Form />);
    const field = screen.getByRole("spinbutton", { name: copy.activities.form.reminderOffsetMinutes });
    expect(screen.getByText(copy.activities.form.reminderHint)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "-1" } });
    fireEvent.blur(field);
    expect(screen.getByText(copy.activities.validation.invalidReminderOffset)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
