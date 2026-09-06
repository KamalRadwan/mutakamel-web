// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { CrmContactLine, type CrmContactLineProps } from "./CrmContactLine";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const EMPTY = {
  honorificTitle: "",
  fullName: "",
  firstName: "",
  lastName: "",
  jobTitle: "",
  email: "",
  phones: [""],
};

function renderLine(overrides: Partial<CrmContactLineProps> = {}) {
  const onFieldChange = vi.fn();
  render(
    <I18nProvider>
      <CrmContactLine
        path="contacts.0"
        contact={EMPTY}
        errors={{}}
        limits={{ name: 80, jobTitle: 120, email: 180 }}
        directoryNameLabel="Contact name"
        onFieldChange={onFieldChange}
        onPhoneChange={vi.fn()}
        onPhoneAdd={vi.fn()}
        onPhoneRemove={vi.fn()}
        onBlur={vi.fn()}
        {...overrides}
      />
    </I18nProvider>,
  );
  return onFieldChange;
}

describe("CrmContactLine", () => {
  function labels(): string[] {
    // The labels themselves, not every node that happens to carry the same
    // words — a picker's placeholder repeats its own label.
    // The asterisk is the required marker the Field renders into the label.
    return [...document.querySelectorAll("label")].map((node) => node.textContent?.trim() ?? "");
  }

  // Six now: a new person is named by its two parts, because that is what the
  // record stores and what stops a form asking for the same name twice.
  it("puts the six fields on the line, in the order a name is read", () => {
    renderLine();
    expect(labels()).toEqual([
      "Honorific",
      "First name *",
      "Last name",
      "Job title",
      "Phone",
      "Email",
    ]);
  });

  it("stores an honorific's label, which is what the wire field holds", () => {
    const onFieldChange = renderLine();
    fireEvent.click(screen.getByLabelText("Honorific"));
    fireEvent.click(screen.getByRole("option", { name: "Dr" }));
    // Not "DR": `honorificTitle` is free text and every screen prints it back.
    expect(onFieldChange).toHaveBeenCalledWith({ honorificTitle: "Dr" });
  });

  it("starts a blank row on the commonest honorific, and really writes it", async () => {
    const onFieldChange = renderLine();
    // Shown but unstored would submit an empty honorific, so the seed is a
    // real write — the same call the phone code's country default makes.
    await waitFor(() => expect(onFieldChange).toHaveBeenCalledWith({ honorificTitle: "Mr" }));
  });

  it("leaves a row that already has one alone", async () => {
    const onFieldChange = renderLine({ contact: { ...EMPTY, honorificTitle: "Dr" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onFieldChange).not.toHaveBeenCalled();
  });

  it("never seeds one for a directory person, whose honorific this form cannot set", async () => {
    const onFieldChange = renderLine({ directoryOwned: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onFieldChange).not.toHaveBeenCalled();
  });

  it("shows a stored honorific written in the other language", () => {
    renderLine({ contact: { ...EMPTY, honorificTitle: "السيدة" } });
    expect(screen.getByLabelText("Honorific")).toHaveTextContent("Mrs");
  });

  it("stacks a second number inside the phone column, not across the line", () => {
    renderLine({ contact: { ...EMPTY, phones: ["+201000000000", "+201111111111"] } });
    // Both numbers live under the one Phone label. Laid out across the line
    // they began under the honorific, which is not where a phone is looked for.
    const phoneCell = screen.getByText("Phone").parentElement as HTMLElement;
    expect(phoneCell.querySelectorAll('input[type="tel"]')).toHaveLength(2);
    expect(screen.getByLabelText("Remove phone 2")).toBeInTheDocument();
    // And the line itself still has its six labels, with no seventh column.
    expect(labels()).toHaveLength(6);
  });

  it("offers no add control on a form that holds a single number", () => {
    renderLine({ onPhoneAdd: undefined, onPhoneRemove: undefined });
    expect(screen.queryByLabelText(en.crmShared.addPhone)).toBeNull();
  });

  // The regression this pins: the editable pair is a FIRST name and a LAST
  // name, and the label over the first box came from the caller. Every contact
  // list passed "Contact name" — a whole-name label — so the row read
  // "Contact name" beside "Last name", which is not a pair of anything. The
  // caller's label now names only the read-only box a directory person gets.
  it("labels the editable pair as first and last, never with the caller's whole-name label", () => {
    renderLine({ directoryNameLabel: "Contact name" });

    expect(labels()).toContain("First name *");
    expect(labels()).toContain("Last name");
    expect(labels()).not.toContain("Contact name *");
  });

  it("uses the caller's label for the one box that really holds a whole name", () => {
    renderLine({
      directoryOwned: true,
      directoryNameLabel: "Contact name",
      contact: { ...EMPTY, fullName: "Dina Adel" },
    });

    expect(labels()).toContain("Contact name");
    expect(labels()).not.toContain("First name *");
  });

  it("shows only what a directory person's form can still set", () => {
    // The service ignores every field submitted for a reused party except the
    // job title and the primary flag, so offering the rest would be a lie.
    // A reused person keeps the single name the directory holds, read-only —
    // there is nothing here to split into parts.
    renderLine({ directoryOwned: true, contact: { ...EMPTY, fullName: "Dina Adel" } });
    expect(labels()).toEqual(["Contact name", "Job title"]);
    expect(screen.getByDisplayValue("Dina Adel")).toBeDisabled();
  });
});
