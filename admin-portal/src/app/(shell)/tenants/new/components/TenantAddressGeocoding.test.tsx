// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reverseGeocodeMock } = vi.hoisted(() => ({
  reverseGeocodeMock: vi.fn(),
}));

vi.mock("../api/tenant-registration.api", () => ({
  tenantRegistrationApi: { reverseGeocode: reverseGeocodeMock },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    dir: "ltr",
    t: {
      tenants: {
        wizard: {
          pickOnMap: "Pick on map",
          mapDialogTitle: "Pick the company location",
          mapDialogDescription: "Drag the marker or click the map.",
          mapConfirm: "Use this location",
          mapCancel: "Cancel",
          mapLoading: "Loading map…",
        },
      },
    },
  }),
}));

// Leaflet needs a laid-out DOM that jsdom does not provide. The picker is
// stubbed so these tests cover the wiring -- point chosen -> reverse geocode
// -> apply -- rather than the map widget itself.
vi.mock("@/components/shared/LocationPickerDialog", () => ({
  LocationPickerDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (location: { latitude: number; longitude: number }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => onConfirm({ latitude: 30.0444, longitude: 31.2357 })}
      >
        confirm-map-point
      </button>
    ) : null,
}));

import {
  TenantAddressGeocoding,
  TenantReverseGeocodeError,
} from "./TenantAddressGeocoding";

describe("TenantAddressGeocoding", () => {
  beforeEach(() => reverseGeocodeMock.mockReset());

  it("asks for a point on the map instead of raw coordinates", () => {
    render(<TenantAddressGeocoding lang="en" onApply={vi.fn()} />);

    // The latitude/longitude boxes are gone: a typo in either silently
    // resolved to the wrong country.
    expect(screen.queryByLabelText(/Latitude/u)).toBeNull();
    expect(screen.queryByLabelText(/Longitude/u)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Pick on map" }),
    ).toBeInTheDocument();
    expect(reverseGeocodeMock).not.toHaveBeenCalled();
  });

  it("renders an editable suggestion and applies it only on confirmation", async () => {
    const onApply = vi.fn();
    const suggestion = {
      countryName: "Egypt",
      countryIsoCode: "EG",
      city: "Cairo",
      street1: "Tahrir Street",
      formattedAddress: "Tahrir Street, Cairo, Egypt",
    };
    reverseGeocodeMock.mockResolvedValue(suggestion);
    render(<TenantAddressGeocoding lang="en" onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-map-point" }));

    await screen.findByText("Tahrir Street, Cairo, Egypt");
    expect(onApply).not.toHaveBeenCalled();
    expect(reverseGeocodeMock).toHaveBeenCalledWith(
      { latitude: 30.0444, longitude: 31.2357 },
      expect.any(AbortSignal),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Apply to editable address fields",
      }),
    );
    expect(onApply).toHaveBeenCalledWith(suggestion);
  });

  it("surfaces the normalized correlation reference", () => {
    render(
      <TenantReverseGeocodeError
        error={{
          isNormalized: true,
          httpStatus: 503,
          errorCode: "CORE.REVERSE_GEOCODING_UNAVAILABLE",
          message: "Reverse geocoding is unavailable.",
          correlationId: "019f-geocode-correlation",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "019f-geocode-correlation",
    );
  });
});
