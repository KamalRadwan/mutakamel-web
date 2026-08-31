"use client";

import { Button, DateTime, Field, FormDrawer, Input, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { BillingBadge } from "../../components/BillingBadge";
import { formatCountdown, useCountdown } from "../../hooks/useCountdown";
import type { usePlanChange } from "../hooks/usePlanChange";

export interface SeatIncreaseDrawerProps {
  planChange: ReturnType<typeof usePlanChange>;
  onApplied: () => void;
}

/**
 * Seat increase in two steps: a durable, price-frozen preview, then the apply
 * that consumes it.
 *
 * The preview expires five minutes after it is priced and `apply` revalidates
 * subscription, collection, price and wallet before committing — so the
 * countdown is shown and the apply control is withdrawn the moment it lapses,
 * rather than left live to earn a `..._PREVIEW_EXPIRED` rejection.
 */
export function SeatIncreaseDrawer({ planChange, onApplied }: SeatIncreaseDrawerProps) {
  const { t, lang } = useI18n();
  const { secondsRemaining, hasLapsed } = useCountdown(
    planChange.stage === "preview" ? (planChange.preview?.expiresAt ?? null) : null,
  );
  const item = planChange.item;
  const preview = planChange.preview;
  const isPreviewStage = planChange.stage === "preview";
  const canApply = isPreviewStage && preview !== null && preview.canApply && !hasLapsed;

  return (
    <FormDrawer
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) planChange.close();
      }}
      title={t.coreBilling.seatIncreaseTitle}
      description={t.coreBilling.seatIncreaseDescription}
      isDirty={false}
      isSubmitting={planChange.isBusy}
      submitDisabled={isPreviewStage && !canApply}
      onSubmit={() => {
        if (!isPreviewStage) {
          void planChange.requestPreview();
          return;
        }
        void planChange.applyPreview().then((ok) => {
          if (ok) onApplied();
        });
      }}
      error={planChange.formError ?? undefined}
      footerLeading={
        isPreviewStage ? (
          <Button variant="ghost" onClick={planChange.backToForm} disabled={planChange.isBusy}>
            {t.coreBilling.changeSeats}
          </Button>
        ) : undefined
      }
      labels={{
        submit: isPreviewStage ? t.coreBilling.applyChange : t.coreBilling.previewChange,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {item && !isPreviewStage && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {formatTemplate(t.coreBilling.currentSeats, {
              seats: formatNumber(item.seats, lang),
            })}
          </p>
          <Field
            label={t.coreBilling.newSeats}
            hint={t.coreBilling.newSeatsHint}
            required
          >
            <Input
              value={planChange.seats}
              inputMode="numeric"
              disabled={planChange.isBusy}
              onChange={(event) => planChange.setSeats(event.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t.coreBilling.increaseOnlyNotice}</p>
        </div>
      )}

      {preview && isPreviewStage && (
        <div className="flex flex-col gap-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <PreviewFigure
              label={t.coreBilling.seatsChange}
              value={formatTemplate(t.coreBilling.seatsFromTo, {
                from: formatNumber(preview.fromSeats ?? 0, lang),
                to: formatNumber(preview.toSeats ?? 0, lang),
              })}
            />
            <PreviewFigure
              label={t.coreBilling.lineTotalChange}
              value={
                <span className="flex flex-wrap items-center gap-1">
                  <Money value={preview.previousLineTotalUsd} currency="USD" />
                  <span aria-hidden="true">→</span>
                  <Money value={preview.nextLineTotalUsd} currency="USD" />
                </span>
              }
            />
            <PreviewFigure
              label={t.coreBilling.prorationDirection}
              value={<BillingBadge kind="ProrationDirection" value={preview.direction} />}
            />
            <PreviewFigure
              label={t.coreBilling.proratedAmount}
              value={<Money value={preview.proratedAmountUsd} currency="USD" />}
            />
            <PreviewFigure
              label={t.coreBilling.walletAvailable}
              value={<Money value={preview.walletAvailableUsd} currency="USD" />}
            />
            <PreviewFigure
              label={t.coreBilling.walletShortfall}
              value={<Money value={preview.walletShortfallUsd} currency="USD" />}
            />
            <PreviewFigure
              label={t.coreBilling.pricedAt}
              value={<DateTime value={preview.pricedAt} />}
            />
          </dl>

          {hasLapsed ? (
            <p className="text-xs text-foreground">{t.coreBilling.previewLapsed}</p>
          ) : (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatTemplate(t.coreBilling.previewExpiresIn, {
                time: formatCountdown(secondsRemaining, lang),
              })}
            </p>
          )}

          {!preview.canApply && !hasLapsed && (
            <p className="text-xs text-foreground">{t.coreBilling.previewCannotApply}</p>
          )}
        </div>
      )}
    </FormDrawer>
  );
}

function PreviewFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs text-foreground">{value}</dd>
    </div>
  );
}
