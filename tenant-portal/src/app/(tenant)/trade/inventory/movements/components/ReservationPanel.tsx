"use client";

import { useState } from "react";
import { Button, DegradedBanner, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_RESERVATION_FORM, type ReservationFormValues } from "../movements-contract";

interface ReservationPanelProps {
  onCreate: (values: ReservationFormValues) => Promise<boolean>;
  onRelease: (
    id: string,
    version: number,
    quantity: string,
    reasonCode: string,
  ) => Promise<boolean>;
  createdId: string | undefined;
  pending: string | null;
  disabled: boolean;
  error: string | null;
}

/**
 * A reservation is created here and released by id.
 *
 * There is no `GET /inventory/reservations`, so the id below is the one the
 * create returned in this session. A release of any other reservation needs
 * its id from wherever it was recorded — the portal cannot look one up.
 */
export function ReservationPanel({
  onCreate,
  onRelease,
  createdId,
  pending,
  disabled,
  error,
}: ReservationPanelProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<ReservationFormValues>(EMPTY_RESERVATION_FORM);
  const [releaseId, setReleaseId] = useState("");
  const [releaseVersion, setReleaseVersion] = useState("1");
  const [releaseQuantity, setReleaseQuantity] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const set = (patch: Partial<ReservationFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.tradeInventory.nodeId} required error={error ?? undefined}>
          <Input
            value={values.nodeId}
            disabled={disabled || pending !== null}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ nodeId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.itemId} required>
          <Input
            value={values.itemId}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ itemId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.uomId} required>
          <Input
            value={values.uomId}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ uomId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.quantity} required hint={t.tradeCommon.decimalHint}>
          <Input
            value={values.quantity}
            inputMode="decimal"
            disabled={disabled || pending !== null}
            onChange={(event) => set({ quantity: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.sourceDocumentId} required>
          <Input
            value={values.sourceDocumentId}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceDocumentId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.sourceLineId} required>
          <Input
            value={values.sourceLineId}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceLineId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.sourceDocumentVersion} required>
          <Input
            type="number"
            min={1}
            value={values.sourceDocumentVersion}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceDocumentVersion: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.sourceLineVersion} required>
          <Input
            type="number"
            min={1}
            value={values.sourceLineVersion}
            disabled={disabled || pending !== null}
            onChange={(event) => set({ sourceLineVersion: event.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={disabled}
          loading={pending === "reservation"}
          onClick={() => {
            void onCreate(values).then((saved) => {
              if (saved) setValues(EMPTY_RESERVATION_FORM);
            });
          }}
        >
          {t.tradeInventory.submitReservation}
        </Button>
      </div>

      {createdId ? (
        <DegradedBanner message={`${t.tradeInventory.lastReservationId}: ${createdId}`} />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">{t.tradeInventory.releaseTitle}</p>
        <p className="text-xs text-muted-foreground">{t.tradeInventory.releaseHint}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t.tradeInventory.reservationId} required>
            <Input
              value={releaseId || (createdId ?? "")}
              disabled={disabled || pending !== null}
              onChange={(event) => setReleaseId(event.target.value)}
            />
          </Field>
          <Field label={t.tradeCommon.version} required hint={t.tradeCommon.ifMatchHint}>
            <Input
              type="number"
              min={1}
              value={releaseVersion}
              disabled={disabled || pending !== null}
              onChange={(event) => setReleaseVersion(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.quantity} hint={t.tradeInventory.releaseQuantityHint}>
            <Input
              value={releaseQuantity}
              inputMode="decimal"
              disabled={disabled || pending !== null}
              onChange={(event) => setReleaseQuantity(event.target.value)}
            />
          </Field>
          <Field label={t.tradeInventory.reasonCode} hint={t.tradeInventory.reasonCodeHint}>
            <Input
              value={releaseReason}
              disabled={disabled || pending !== null}
              onChange={(event) => setReleaseReason(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={disabled}
            loading={pending === "release"}
            onClick={() =>
              void onRelease(
                releaseId || (createdId ?? ""),
                Number(releaseVersion),
                releaseQuantity,
                releaseReason,
              )
            }
          >
            {t.tradeInventory.submitRelease}
          </Button>
        </div>
      </div>
    </div>
  );
}
