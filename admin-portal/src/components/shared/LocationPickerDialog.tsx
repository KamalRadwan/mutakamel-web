"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

interface LocationPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: PickedLocation) => void;
  /** Starting pin. Defaults to downtown Cairo. */
  initial?: PickedLocation;
}

/** Tahrir Square — the platform's home market, and a recognisable centre. */
const CAIRO_DOWNTOWN: PickedLocation = { latitude: 30.0444, longitude: 31.2357 };

/**
 * Map location picker.
 *
 * Replaces the pair of raw latitude/longitude number fields the wizard used
 * to show. Coordinates are not something an administrator carries around, and
 * a typo in either box silently resolved to the wrong country.
 *
 * Leaflet is loaded on demand rather than imported at module scope: it
 * touches `window` at import time, which breaks server rendering, and it is
 * dead weight for the majority of registrations that never open the map.
 */
export function LocationPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  initial,
}: LocationPickerDialogProps) {
  const { t, dir } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  // Read the starting pin as two numbers rather than as the `initial` object.
  // A caller that builds that object inline hands us a new identity on every
  // render, and an effect keyed on it would tear the map down — and move the
  // pin back to the start — while the administrator is still dragging it.
  const startLatitude = initial?.latitude ?? CAIRO_DOWNTOWN.latitude;
  const startLongitude = initial?.longitude ?? CAIRO_DOWNTOWN.longitude;
  const [picked, setPicked] = useState<PickedLocation>({
    latitude: startLatitude,
    longitude: startLongitude,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const leaflet = await import("leaflet");
      // The dialog can close while the chunk is still in flight.
      if (cancelled || !containerRef.current) return;

      const start = { latitude: startLatitude, longitude: startLongitude };
      const map = leaflet.map(containerRef.current).setView(
        [start.latitude, start.longitude],
        13,
      );
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Required by the OSM tile usage policy.
          attribution: "© OpenStreetMap contributors",
        })
        .addTo(map);

      // The default marker icon resolves its PNGs by relative URL, which does
      // not survive bundling; a divIcon keeps the pin dependency-free.
      const marker = leaflet
        .marker([start.latitude, start.longitude], {
          draggable: true,
          icon: leaflet.divIcon({
            className: "",
            html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
        .addTo(map);

      const commit = (lat: number, lng: number) => {
        setPicked({ latitude: lat, longitude: lng });
      };
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        commit(lat, lng);
      });
      map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(event.latlng);
        commit(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      setIsReady(true);
      // Radix animates the dialog in; Leaflet measures a container that is
      // still mid-transition and renders grey tiles unless told to re-measure.
      const settle = window.setTimeout(() => map.invalidateSize(), 150);
      cleanup = () => {
        window.clearTimeout(settle);
        map.remove();
        mapRef.current = null;
        setIsReady(false);
        // The pick belongs to this opening of the map, and to no other. The
        // only point this dialog may hand back is one the administrator
        // confirmed; a pin they dropped and then cancelled must not survive
        // into the next opening, where the map is showing the start point
        // again and Confirm would submit a location nobody can see.
        setPicked(start);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [open, startLatitude, startLongitude]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.tenants.wizard.mapDialogTitle}</DialogTitle>
          <DialogDescription>
            {t.tenants.wizard.mapDialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border border-border">
          <div
            ref={containerRef}
            className="h-[360px] w-full"
            // Leaflet renders its own interactive surface; the confirmed
            // coordinates are announced through the readout below.
            role="application"
            aria-label={t.tenants.wizard.mapDialogTitle}
          />
          {!isReady ? (
            <p
              role="status"
              className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground"
            >
              {t.tenants.wizard.mapLoading}
            </p>
          ) : null}
        </div>

        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
          {picked.latitude.toFixed(6)}, {picked.longitude.toFixed(6)}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.tenants.wizard.mapCancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onConfirm(picked);
              onOpenChange(false);
            }}
          >
            {t.tenants.wizard.mapConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
