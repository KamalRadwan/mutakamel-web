"use client";

import { WEBPHONE_COPY } from "../webphone-copy";
import type { WebphoneSeats } from "../webphone-contract";

/**
 * Seat accounting rendered honestly.
 *
 * `available` is clamped at zero by the contract parser, so occupancy above the
 * allowance shows as an explicit "over allowance" state with the overage
 * spelled out — never as a negative availability. That state is legitimate:
 * reducing a tenant's seats does not switch off a phone that is already
 * working.
 */
export function SeatCounter({
  lang,
  seats,
  heading,
}: {
  lang: "ar" | "en";
  seats: WebphoneSeats;
  heading: string;
}) {
  const copy = WEBPHONE_COPY[lang];
  const overage = Math.max(0, seats.occupied - seats.allowed);

  return (
    <div
      className={`rounded-xl border p-3 ${
        seats.overAllowance
          ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs">{heading}</strong>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            seats.overAllowance
              ? "bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {seats.overAllowance
            ? `${copy.overAllowance}: ${overage} ${copy.overAllowanceBy}`
            : copy.seatsWithinAllowance}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="font-bold text-slate-500">{copy.seatsAllowed}</dt>
          <dd>{seats.allowed}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">{copy.seatsOccupied}</dt>
          <dd>{seats.occupied}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">{copy.seatsAvailable}</dt>
          <dd>{seats.available}</dd>
        </div>
      </dl>
    </div>
  );
}
