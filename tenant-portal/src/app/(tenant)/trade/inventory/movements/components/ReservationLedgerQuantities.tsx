"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import type { ReservationSnapshot } from "../movements-contract";

export function ReservationLedgerQuantities({ reservation }: { reservation: ReservationSnapshot }) {
  const { t, lang } = useI18n();
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <dt className="text-muted-foreground">{t.tradeInventory.reservationRemainingQuantity}</dt>
        <dd className="tabular-nums">{formatDecimalString(reservation.remainingQuantity, lang, { maximumFractionDigits: 8 })}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t.tradeInventory.reservationReleasedQuantity}</dt>
        <dd className="tabular-nums">{formatDecimalString(reservation.releasedQuantity, lang, { maximumFractionDigits: 8 })}</dd>
      </div>
    </dl>
  );
}
