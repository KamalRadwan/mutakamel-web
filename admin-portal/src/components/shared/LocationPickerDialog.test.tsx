// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationPickerDialog, type PickedLocation } from "./LocationPickerDialog";

vi.mock("@/i18n/I18nContext", () => ({
  useOptionalI18n: () => null,
  useI18n: () => ({
    dir: "ltr",
    lang: "en",
    t: {
      common: { close: "Close" },
      tenants: {
        wizard: {
          mapDialogTitle: "Pick a location",
          mapDialogDescription: "Drag the pin to the tenant's address.",
          mapLoading: "Loading the map…",
          mapCancel: "Cancel",
          mapConfirm: "Confirm",
        },
      },
    },
  }),
}));

/**
 * A single map click handler, captured from the stub, so a test can drop the
 * pin somewhere without a real tile server.
 */
let clickMap: ((latitude: number, longitude: number) => void) | null = null;
let markerPosition: { lat: number; lng: number } | null = null;

vi.mock("leaflet", () => {
  const map = {
    setView: () => map,
    on: (
      event: string,
      handler: (payload: { latlng: { lat: number; lng: number } }) => void,
    ) => {
      if (event !== "click") return;
      clickMap = (latitude, longitude) =>
        handler({ latlng: { lat: latitude, lng: longitude } });
    },
    invalidateSize: () => undefined,
    remove: () => undefined,
  };
  const marker = {
    addTo: () => marker,
    on: () => undefined,
    getLatLng: () => markerPosition,
    setLatLng: (next: { lat: number; lng: number }) => {
      markerPosition = next;
    },
  };
  const tiles = { addTo: () => tiles };
  return {
    map: () => map,
    tileLayer: () => tiles,
    marker: (position: [number, number]) => {
      markerPosition = { lat: position[0], lng: position[1] };
      return marker;
    },
    divIcon: () => ({}),
  };
});

const CAIRO_READOUT = "30.044400, 31.235700";

function PickerHarness({ onConfirm }: { onConfirm: (point: PickedLocation) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open-map
      </button>
      <LocationPickerDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
    </div>
  );
}

async function openPicker() {
  fireEvent.click(screen.getByText("open-map"));
  await waitFor(() => expect(screen.getByText(CAIRO_READOUT)).toBeTruthy());
}

describe("LocationPickerDialog", () => {
  beforeEach(() => {
    clickMap = null;
    markerPosition = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forgets a cancelled pick when the map is opened again", async () => {
    // The wizard keeps this dialog mounted, so its state survives a close. An
    // administrator who drops the pin on the wrong city, cancels, and reopens
    // sees the map back at Cairo — and used to confirm the abandoned point
    // anyway, sending a different city to the reverse-geocode lookup.
    const onConfirm = vi.fn();
    render(<PickerHarness onConfirm={onConfirm} />);

    await openPicker();
    clickMap?.(24.7136, 46.6753);
    await waitFor(() => expect(screen.getByText("24.713600, 46.675300")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Cancel")).toBeNull());

    await openPicker();
    expect(screen.queryByText("24.713600, 46.675300")).toBeNull();

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 30.0444, longitude: 31.2357 });
  });

  it("hands back the point the administrator confirmed", async () => {
    const onConfirm = vi.fn();
    render(<PickerHarness onConfirm={onConfirm} />);

    await openPicker();
    clickMap?.(31.2001, 29.9187);
    await waitFor(() => expect(screen.getByText("31.200100, 29.918700")).toBeTruthy());

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 31.2001, longitude: 29.9187 });
  });
});
