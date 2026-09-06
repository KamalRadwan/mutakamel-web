// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { AddressPlaceSelect } from "./AddressPlaceSelect";
import type { AddressPlaceLoader, AddressPlaceResult } from "./useAddressPlaceOptions";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const LABELS = {
  placeholder: en.address.chooseState,
  searchPlaceholder: en.address.searchStates,
  emptyLabel: en.address.noMatchingStates,
  clearLabel: en.address.clearState,
};

function result(names: string[], total = names.length): AddressPlaceResult {
  return {
    options: names.map((name, index) => ({ key: `k${index}`, name })),
    total,
    truncated: total > names.length,
  };
}

function Harness({ loader, initial = "" }: { loader: AddressPlaceLoader | null; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider>
      <Field label="State or region">
        <AddressPlaceSelect
          value={value}
          loader={loader}
          labels={LABELS}
          maxLength={120}
          onChange={(change) => setValue(change.name)}
        />
      </Field>
      <output data-testid="stored">{value}</output>
    </I18nProvider>
  );
}

const stored = () => screen.getByTestId("stored").textContent;
const control = () => screen.getByLabelText("State or region");

describe("AddressPlaceSelect", () => {
  it("stores the NAME the free-text column takes, never the catalogue key", async () => {
    render(<Harness loader={() => Promise.resolve(result(["Cairo", "Giza"]))} />);
    await waitFor(() => expect(control().tagName).toBe("BUTTON"));

    fireEvent.click(control());
    fireEvent.click(screen.getByText("Giza"));

    expect(stored()).toBe("Giza");
  });

  it("shows a stored value the catalogue does not carry, and keeps it", async () => {
    render(
      <Harness loader={() => Promise.resolve(result(["Cairo"]))} initial="Ash Sharqia" />,
    );
    await waitFor(() => expect(control().tagName).toBe("BUTTON"));

    expect(control()).toHaveTextContent("Ash Sharqia");
    expect(stored()).toBe("Ash Sharqia");
  });

  it("tells the reader to keep typing rather than passing a partial list off as whole", async () => {
    render(<Harness loader={() => Promise.resolve(result(["Nasr City"], 340))} />);
    await waitFor(() => expect(control().tagName).toBe("BUTTON"));
    fireEvent.click(control());

    const hint = screen.getByText("Showing 1 of 340 — keep typing to narrow the list.");
    // A count, not an option: clicking it must not write a place name.
    fireEvent.click(hint);
    expect(stored()).toBe("");
  });

  it("searches on the server, because no page held here is the whole answer", async () => {
    const loader = vi.fn(() => Promise.resolve(result(["Cairo"])));
    render(<Harness loader={loader} />);
    await waitFor(() => expect(control().tagName).toBe("BUTTON"));

    fireEvent.click(control());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "giz" } });

    await waitFor(() =>
      expect(loader).toHaveBeenCalledWith("giz", expect.any(AbortSignal)),
    );
  });

  it("is a plain box, not an error, when there is no catalogue to offer", () => {
    render(<Harness loader={null} initial="Qalyubia" />);

    expect(control().tagName).toBe("INPUT");
    expect(control()).toHaveValue("Qalyubia");
    fireEvent.change(control(), { target: { value: "Qalyubia Governorate" } });
    expect(stored()).toBe("Qalyubia Governorate");
  });
});
