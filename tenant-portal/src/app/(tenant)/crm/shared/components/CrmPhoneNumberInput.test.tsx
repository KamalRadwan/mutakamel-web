// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { CrmPhoneNumberInput } from "./CrmPhoneNumberInput";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

/** The form owns the one string; this mirrors how `CrmPhoneListField` holds it. */
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider>
      <Field label="Phone">
        <CrmPhoneNumberInput
          value={value}
          maxLength={32}
          onChange={setValue}
          onBlur={() => undefined}
        />
      </Field>
      <output data-testid="stored">{value}</output>
    </I18nProvider>
  );
}

const stored = () => screen.getByTestId("stored").textContent;
const numberBox = () => screen.getByLabelText("Phone");
const codeButton = () => screen.getByRole("button", { name: /Country code|\+/ });

function chooseCountry(name: string) {
  fireEvent.click(codeButton());
  fireEvent.click(screen.getByText(name));
}

describe("CrmPhoneNumberInput", () => {
  it("shows an existing number split across the two controls", () => {
    render(<Harness initial="+201050049899" />);
    expect(numberBox()).toHaveValue("1050049899");
    expect(codeButton()).toHaveTextContent("+20");
  });

  it("stores one string, which is what the DTO takes", () => {
    render(<Harness />);
    chooseCountry("Egypt");
    fireEvent.change(numberBox(), { target: { value: "1050049899" } });
    expect(stored()).toBe("+201050049899");
  });

  it("stores nothing for a country with no number behind it", () => {
    render(<Harness />);
    chooseCountry("Egypt");
    // "+20" is not a phone number, and an empty row is how the builders know
    // to drop it.
    expect(stored()).toBe("");
    // The choice survives anyway, which is the reason the country is state.
    expect(codeButton()).toHaveTextContent("+20");
  });

  it("splits a pasted international number instead of prefixing it twice", () => {
    render(<Harness />);
    chooseCountry("Egypt");
    fireEvent.change(numberBox(), { target: { value: "+9715551234" } });
    expect(stored()).toBe("+9715551234");
    expect(numberBox()).toHaveValue("5551234");
    expect(codeButton()).toHaveTextContent("+971");
  });

  it("drops the trunk zero from a number written the local way", () => {
    // "01050049899" is how an Egyptian number is dialled from inside Egypt.
    // That leading 0 is exactly what the calling code replaces, so keeping it
    // beside +20 would send one digit too many.
    render(<Harness />);
    chooseCountry("Egypt");
    fireEvent.change(numberBox(), { target: { value: "01050049899" } });
    expect(numberBox()).toHaveValue("1050049899");
    expect(stored()).toBe("+201050049899");
  });

  it("never accepts a leading zero as it is typed", () => {
    render(<Harness />);
    chooseCountry("Egypt");
    // The field holds the whole value on every keystroke, so the first "0" is
    // refused as it arrives rather than cleaned up on blur.
    fireEvent.change(numberBox(), { target: { value: "0" } });
    expect(numberBox()).toHaveValue("");
    fireEvent.change(numberBox(), { target: { value: "1" } });
    expect(numberBox()).toHaveValue("1");
  });

  it("reads a pasted 00 prefix as the + it stands for", () => {
    // The one place a leading zero means something: 00 is the international
    // prefix, so this is a +20 number and has to split like one.
    render(<Harness />);
    fireEvent.change(numberBox(), { target: { value: "00201050049899" } });
    expect(codeButton()).toHaveTextContent("+20");
    expect(numberBox()).toHaveValue("1050049899");
    expect(stored()).toBe("+201050049899");
  });

  it("strips a trunk zero left behind a pasted calling code", () => {
    // Contact sheets are full of "+20 010…", which is both forms at once.
    render(<Harness />);
    fireEvent.change(numberBox(), { target: { value: "+2001050049899" } });
    expect(codeButton()).toHaveTextContent("+20");
    expect(stored()).toBe("+201050049899");
  });

  it("keeps the country the user picked, not the first that shares its code", () => {
    render(<Harness />);
    // 25 countries dial +1; resolving the flag from the code alone would show
    // whichever sorts first.
    chooseCountry("United States");
    expect(codeButton()).toHaveTextContent("🇺🇸");
  });

  it("finds a country by the other language's name, and by its code", async () => {
    render(<Harness />);
    fireEvent.click(codeButton());
    const search = screen.getByRole("combobox");

    // An English reader typing the Arabic name still lands on the row.
    fireEvent.change(search, { target: { value: "مصر" } });
    await waitFor(() => expect(screen.queryByText("Japan")).toBeNull());
    expect(screen.getByText("Egypt")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "971" } });
    await waitFor(() => expect(screen.queryByText("Egypt")).toBeNull());
    expect(screen.getByText("United Arab Emirates")).toBeInTheDocument();
  });
});

describe("the country it opens on", () => {
  function withTimeZone(zone: string) {
    const real = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(((...args: unknown[]) => {
      const formatter = new (real as unknown as new (...a: unknown[]) => Intl.DateTimeFormat)(
        ...args,
      );
      return {
        ...formatter,
        resolvedOptions: () => ({ ...formatter.resolvedOptions(), timeZone: zone }),
      } as Intl.DateTimeFormat;
    }) as unknown as typeof Intl.DateTimeFormat);
  }

  afterEach(() => vi.restoreAllMocks());

  it("starts on the reader's own country, read from the browser's timezone", async () => {
    withTimeZone("Africa/Cairo");
    render(<Harness />);
    // Seeded after mount, never during render: the server's timezone is not
    // the reader's, and a value read while rendering would not match the
    // markup the server sent.
    await waitFor(() => expect(codeButton()).toHaveTextContent("+20"));
  });

  it("leaves an existing number's own code alone", async () => {
    withTimeZone("Africa/Cairo");
    render(<Harness initial="+9715551234" />);
    await waitFor(() => expect(codeButton()).toHaveTextContent("+971"));
    expect(codeButton()).not.toHaveTextContent("+20");
  });

  it("stays empty for a timezone the table has never heard of", async () => {
    // A stale alias must not silently prefix somebody's number with the wrong
    // country, so an unknown zone resolves to nothing rather than to a guess.
    withTimeZone("Mars/Olympus_Mons");
    render(<Harness />);
    await waitFor(() => expect(codeButton()).toHaveTextContent("Country code"));
  });
});
