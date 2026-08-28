"use client";

import { Armchair } from "lucide-react";
import { WEBPHONE_COPY } from "../webphone-copy";
import type { WebphoneSeats } from "../webphone-contract";

/**
 * Seat accounting rendered honestly.
 *
 * `available` is clamped at zero by the contract parser, so occupancy above the
 * allowance appears as an explicit over-allowance state with the overage spelled
 * out — never as a negative availability. That state is legitimate and expected:
 * reducing seats does not switch off a phone that is already working, so the
 * screen explains it instead of implying a fault.
 */
export function TenantSeatCounter({
  seats,
  lang,
}: {
  seats: WebphoneSeats | null;
  lang: "ar" | "en";
}) {
  const copy = WEBPHONE_COPY[lang];
  const overage = seats ? Math.max(0, seats.occupied - seats.allowed) : 0;

  return (
    <section
      aria-label={copy.seatsSection}
      className={`rounded-2xl border p-4 shadow-sm ${
        seats?.overAllowance
          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Armchair className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          {copy.seatsHeading}
        </h2>
        {seats ? (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              seats.overAllowance
                ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-100"
                : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {seats.overAllowance
              ? `${copy.overAllowance}: ${overage} ${copy.overAllowanceBy}`
              : copy.seatsWithinAllowance}
          </span>
        ) : null}
      </div>

      {seats ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="font-semibold text-slate-500">{copy.seatsAllowed}</dt>
              <dd className="mt-0.5 text-sm font-bold">{seats.allowed}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">{copy.seatsOccupied}</dt>
              <dd className="mt-0.5 text-sm font-bold">{seats.occupied}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">{copy.seatsAvailable}</dt>
              <dd className="mt-0.5 text-sm font-bold">{seats.available}</dd>
            </div>
          </dl>
          {seats.overAllowance ? (
            <p className="mt-3 text-[11px] leading-5 font-semibold text-amber-800 dark:text-amber-200">
              {copy.overAllowanceExplanation}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {copy.seatsUnavailable}
        </p>
      )}
    </section>
  );
}
