// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import type { GeographyCity, GeographyList, GeographyState } from "@/lib/geo/geography-api";
import { AddressPlaceFields, type AddressPlaceValues } from "./AddressPlaceFields";

const { fetchStates, fetchCities } = vi.hoisted(() => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
}));
vi.mock("@/lib/geo/geography-api", () => ({
  fetchGeographyStates: fetchStates,
  fetchGeographyCities: fetchCities,
}));
vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(() => {
  cleanup();
  fetchStates.mockReset();
  fetchCities.mockReset();
});

function page<T>(items: T[], total = items.length): GeographyList<T> {
  return { items, total, truncated: total > items.length };
}

const state = (code: string, name: string): GeographyState => ({
  code,
  name,
  nativeName: null,
  type: "Governorate",
});
const city = (id: number, name: string): GeographyCity => ({ id, name, nativeName: null });

const EGYPT = page([state("C", "Cairo"), state("GZ", "Giza")]);
const EMIRATES = page([state("DU", "Dubai")]);

function Harness({ initial = {} }: { initial?: Partial<AddressPlaceValues> }) {
  const [values, setValues] = useState<AddressPlaceValues>({
    country: "",
    state: "",
    city: "",
    ...initial,
  });
  return (
    <I18nProvider>
      <AddressPlaceFields
        values={values}
        labels={{ country: "Country", state: "State or region", city: "City" }}
        maxLength={120}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />
      <output data-testid="stored">{JSON.stringify(values)}</output>
    </I18nProvider>
  );
}

const stored = (): AddressPlaceValues =>
  JSON.parse(screen.getByTestId("stored").textContent ?? "{}") as AddressPlaceValues;
const control = (label: string) => screen.getByLabelText(label);
const pick = (label: string, option: string) => {
  fireEvent.click(control(label));
  fireEvent.click(screen.getByText(option));
};

describe("AddressPlaceFields cascade", () => {
  it("clears the state and the city when the country changes", async () => {
    fetchStates.mockResolvedValue(EMIRATES);
    render(<Harness initial={{ country: "Egypt", state: "Cairo", city: "Nasr City" }} />);

    pick("Country", "🇦🇪 United Arab Emirates");

    // Both belonged to Egypt. Keeping them would submit an address that does
    // not exist anywhere.
    expect(stored()).toEqual({ country: "United Arab Emirates", state: "", city: "" });
  });

  it("clears the city when the state changes", async () => {
    fetchStates.mockResolvedValue(EGYPT);
    render(<Harness initial={{ country: "Egypt", city: "Nasr City" }} />);
    await waitFor(() => expect(control("State or region").tagName).toBe("BUTTON"));

    pick("State or region", "Cairo");

    expect(stored()).toEqual({ country: "Egypt", state: "Cairo", city: "" });
  });

  it("opens the city catalogue only once a state has been picked from the list", async () => {
    fetchStates.mockResolvedValue(EGYPT);
    fetchCities.mockResolvedValue(page([city(12, "Nasr City")]));
    render(<Harness initial={{ country: "Egypt" }} />);
    await waitFor(() => expect(control("State or region").tagName).toBe("BUTTON"));

    // Until then there is no subdivision code to ask cities for.
    expect(control("City").tagName).toBe("INPUT");
    expect(fetchCities).not.toHaveBeenCalled();

    pick("State or region", "Cairo");
    await waitFor(() => expect(control("City").tagName).toBe("BUTTON"));
    expect(fetchCities).toHaveBeenCalledWith("EG", "C", expect.anything());

    pick("City", "Nasr City");
    expect(stored()).toEqual({ country: "Egypt", state: "Cairo", city: "Nasr City" });
  });
});

describe("AddressPlaceFields degraded catalogues", () => {
  it("is a plain box while no country is chosen, and still records what is typed", () => {
    render(<Harness />);

    const box = control("State or region");
    expect(box.tagName).toBe("INPUT");
    expect(fetchStates).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: "Ash Sharqia" } });
    expect(stored().state).toBe("Ash Sharqia");
  });

  it("stays a plain box for a country the catalogue holds no subdivisions for", async () => {
    fetchStates.mockResolvedValue(page<GeographyState>([]));
    render(<Harness initial={{ country: "Vatican City" }} />);

    await waitFor(() => expect(fetchStates).toHaveBeenCalled());
    expect(control("State or region").tagName).toBe("INPUT");
  });

  it("falls back to typing when the catalogue cannot be reached", async () => {
    // Nobody may be left unable to record where a customer lives because a
    // reference table is down.
    fetchStates.mockRejectedValue(new Error("Invalid Core geography response."));
    render(<Harness initial={{ country: "Egypt" }} />);

    await waitFor(() => expect(control("State or region").tagName).toBe("INPUT"));
    fireEvent.change(control("State or region"), { target: { value: "Qalyubia" } });
    expect(stored().state).toBe("Qalyubia");
  });

  it("keeps typing in the state box from wiping a city already written", async () => {
    fetchStates.mockRejectedValue(new Error("Invalid Core geography response."));
    render(<Harness initial={{ country: "Egypt", city: "Banha" }} />);
    await waitFor(() => expect(control("State or region").tagName).toBe("INPUT"));

    fireEvent.change(control("State or region"), { target: { value: "Qaly" } });

    // A typed state breaks no catalogue relationship, so nothing downstream is
    // cleared — the cascade only fires on a pick.
    expect(stored()).toEqual({ country: "Egypt", state: "Qaly", city: "Banha" });
  });
});

describe("AddressPlaceFields with values that predate it", () => {
  it("shows a stored state the catalogue does not carry, rather than blanking it", async () => {
    fetchStates.mockResolvedValue(EGYPT);
    render(
      <Harness initial={{ country: "Egypt", state: "Ash Sharqia Governorate", city: "Zagazig" }} />,
    );

    await waitFor(() => expect(control("State or region").tagName).toBe("BUTTON"));
    expect(control("State or region")).toHaveTextContent("Ash Sharqia Governorate");
    // No subdivision code was ever picked, so the city stays a box holding its
    // own value — unassisted, never blocked.
    expect(control("City")).toHaveValue("Zagazig");
    expect(stored()).toEqual({
      country: "Egypt",
      state: "Ash Sharqia Governorate",
      city: "Zagazig",
    });
  });
});

describe("AddressPlaceFields stale responses", () => {
  it("ignores a slow answer for the country the user has already left", async () => {
    let releaseEgypt: ((value: GeographyList<GeographyState>) => void) | undefined;
    const egypt = new Promise<GeographyList<GeographyState>>((resolve) => {
      releaseEgypt = resolve;
    });
    fetchStates.mockImplementation((iso: string) =>
      iso === "EG" ? egypt : Promise.resolve(EMIRATES),
    );

    render(<Harness initial={{ country: "Egypt" }} />);
    pick("Country", "🇦🇪 United Arab Emirates");
    await waitFor(() => expect(control("State or region").tagName).toBe("BUTTON"));

    await act(async () => {
      releaseEgypt?.(EGYPT);
      await egypt;
    });

    fireEvent.click(control("State or region"));
    expect(screen.getByText("Dubai")).toBeInTheDocument();
    expect(screen.queryByText("Cairo")).toBeNull();
  });
});
