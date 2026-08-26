"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { tenantRegistrationApi } from "../api/tenant-registration.api";
import { parseCoordinate } from "../lib/tenant-reverse-geocode";
import type { TenantReverseGeocodedAddress } from "../types";

export type CoordinateValidationCode =
  | "INVALID_LATITUDE_FORMAT"
  | "INVALID_LATITUDE_RANGE"
  | "INVALID_LONGITUDE_FORMAT"
  | "INVALID_LONGITUDE_RANGE";

export function useTenantReverseGeocode() {
  const [latitude, setLatitudeValue] = useState("");
  const [longitude, setLongitudeValue] = useState("");
  const [validationCode, setValidationCode] =
    useState<CoordinateValidationCode | null>(null);
  const [suggestion, setSuggestion] =
    useState<TenantReverseGeocodedAddress | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestGeneration.current += 1;
      requestAbort.current?.abort();
    },
    [],
  );

  const changeCoordinate = useCallback(
    (field: "latitude" | "longitude", value: string) => {
      requestGeneration.current += 1;
      requestAbort.current?.abort();
      setValidationCode(null);
      setError(null);
      setSuggestion(null);
      if (field === "latitude") setLatitudeValue(value);
      else setLongitudeValue(value);
    },
    [],
  );

  const lookup = useCallback(async () => {
    let latitudeValue: number;
    let longitudeValue: number;
    try {
      latitudeValue = parseCoordinate(latitude, "latitude");
      longitudeValue = parseCoordinate(longitude, "longitude");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setValidationCode(
        isCoordinateValidationCode(code) ? code : "INVALID_LATITUDE_FORMAT",
      );
      setSuggestion(null);
      setError(null);
      return;
    }

    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setValidationCode(null);
    setError(null);
    setSuggestion(null);
    setIsLoading(true);
    try {
      const result = await tenantRegistrationApi.reverseGeocode(
        { latitude: latitudeValue, longitude: longitudeValue },
        controller.signal,
      );
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setSuggestion(result);
    } catch (caught) {
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setError(normalizeApiError(caught));
    } finally {
      if (generation === requestGeneration.current) {
        setIsLoading(false);
      }
    }
  }, [latitude, longitude]);

  return {
    latitude,
    longitude,
    validationCode,
    suggestion,
    error,
    isLoading,
    setLatitude: (value: string) => changeCoordinate("latitude", value),
    setLongitude: (value: string) => changeCoordinate("longitude", value),
    lookup,
  };
}

function isCoordinateValidationCode(
  value: string,
): value is CoordinateValidationCode {
  return [
    "INVALID_LATITUDE_FORMAT",
    "INVALID_LATITUDE_RANGE",
    "INVALID_LONGITUDE_FORMAT",
    "INVALID_LONGITUDE_RANGE",
  ].includes(value);
}
