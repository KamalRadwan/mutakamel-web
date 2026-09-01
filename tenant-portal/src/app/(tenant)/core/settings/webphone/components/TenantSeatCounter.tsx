"use client";

import { Armchair } from "lucide-react";
import { Badge, Card } from "@/design-system";
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
 *
 * The over-allowance signal is a `caution` badge carrying its own words, so the
 * state survives a monochrome rendering — colour is reinforcement, never the
 * only carrier.
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
    <Card role="region" aria-label={copy.seatsSection} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <Armchair className="size-4 text-muted-foreground" aria-hidden="true" />
          {copy.seatsHeading}
        </h2>
        {seats ? (
          <Badge tone={seats.overAllowance ? "caution" : "neutral"}>
            {seats.overAllowance
              ? `${copy.overAllowance}: ${overage} ${copy.overAllowanceBy}`
              : copy.seatsWithinAllowance}
          </Badge>
        ) : null}
      </div>

      {seats ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="font-medium text-muted-foreground">{copy.seatsAllowed}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">
                {seats.allowed}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">{copy.seatsOccupied}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">
                {seats.occupied}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">{copy.seatsAvailable}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">
                {seats.available}
              </dd>
            </div>
          </dl>
          {seats.overAllowance ? (
            <p className="mt-3 max-w-prose text-xs text-muted-foreground">
              {copy.overAllowanceExplanation}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{copy.seatsUnavailable}</p>
      )}
    </Card>
  );
}
