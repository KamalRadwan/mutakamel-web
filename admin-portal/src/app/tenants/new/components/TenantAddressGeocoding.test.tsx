// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reverseGeocodeMock } = vi.hoisted(() => ({
  reverseGeocodeMock: vi.fn(),
}));

vi.mock("../api/tenant-registration.api", () => ({
  tenantRegistrationApi: { reverseGeocode: reverseGeocodeMock },
}));

import {
  TenantAddressGeocoding,
  TenantReverseGeocodeError,
} from "./TenantAddressGeocoding";

describe("TenantAddressGeocoding", () => {
  beforeEach(() => reverseGeocodeMock.mockReset());

  it("validates coordinates before calling Core", () => {
    render(<TenantAddressGeocoding lang="en" onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Latitude (-90 to 90)"), {
      target: { value: "30.12345678" },
    });
    fireEvent.change(screen.getByLabelText("Longitude (-180 to 180)"), {
      target: { value: "31.2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find address" }));

    expect(reverseGeocodeMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "no more than seven decimal places",
    );
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

    fireEvent.change(screen.getByLabelText("Latitude (-90 to 90)"), {
      target: { value: "30.0444" },
    });
    fireEvent.change(screen.getByLabelText("Longitude (-180 to 180)"), {
      target: { value: "31.2357" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find address" }));

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
