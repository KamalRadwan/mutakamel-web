// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { AddressCountrySelect } from "./AddressCountrySelect";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider>
      <Field label="Country">
        <AddressCountrySelect value={value} onChange={setValue} onBlur={() => undefined} />
      </Field>
      <output data-testid="stored">{value}</output>
    </I18nProvider>
  );
}

const stored = () => screen.getByTestId("stored").textContent;
const trigger = () => screen.getByLabelText("Country");

describe("AddressCountrySelect", () => {
  it("stores the name the DTO's free-text country actually takes", () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("🇪🇬 Egypt"));
    // Not "EG": every screen that prints an address prints this string as-is.
    expect(stored()).toBe("Egypt");
  });

  it("shows a stored country with its flag", () => {
    render(<Harness initial="Egypt" />);
    expect(trigger()).toHaveTextContent("🇪🇬 Egypt");
  });

  it("recognises a country stored in the other language", () => {
    render(<Harness initial="مصر" />);
    // Read in English, written in Arabic — still Egypt, and still stored as
    // the Arabic string until someone picks a different country.
    expect(trigger()).toHaveTextContent("🇪🇬 Egypt");
    expect(stored()).toBe("مصر");
  });

  it("keeps a value that matches no country, rather than blanking the record", () => {
    render(<Harness initial="Yugoslavia" />);
    expect(trigger()).toHaveTextContent("Yugoslavia");
    expect(stored()).toBe("Yugoslavia");
  });

  it("narrows the list as the reader types", async () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "emirates" } });
    await waitFor(() => expect(screen.queryByText("🇪🇬 Egypt")).toBeNull());
    expect(screen.getByText("🇦🇪 United Arab Emirates")).toBeInTheDocument();
  });

  it("clears back to nothing, because the DTO's country is optional", () => {
    render(<Harness initial="Egypt" />);
    fireEvent.click(screen.getByRole("button", { name: en.address.clearCountry }));
    expect(stored()).toBe("");
  });
});
