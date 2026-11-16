"use client";

import { buildDeliveryRequest, buildOpeningBalanceRequest, buildReceiptRequest, buildReleaseRequest, buildReservationRequest, buildReversalRequest } from "../movement-request-builders";
import { useCallback, useMemo, useState } from "react";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { record } from "../../../trade-advanced-validation";
import { splitSerialInput } from "../serial-input";
import { useMovementCommandRunner } from "./useMovementCommandRunner";
import { useMovementNodes } from "./useMovementNodes";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../../trade-advanced-scope";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  INVENTORY_ADJUST_PERMISSION,
  INVENTORY_DELIVER_PERMISSION,
  INVENTORY_DELIVERIES_PATH,
  INVENTORY_OPENING_BALANCES_PATH,
  INVENTORY_OPENING_BALANCE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  INVENTORY_RECEIPTS_PATH,
  INVENTORY_RECEIVE_PERMISSION,
  INVENTORY_RESERVATIONS_PATH,
  INVENTORY_RESERVE_PERMISSION,
  invalidResponse,
} from "../../inventory-contract";
import {
  deliveryActionPath,
  parseMovementId,
  parseMovementLines,
  parseMovementStatus,
  parseReservation,
  receiptActionPath,
  reservationReleasePath,
  type MovementFormValues,
  type OpeningBalanceFormValues,
  type ReservationFormValues,
  type ReversalLineValues,
  type SessionMovementEntry,
} from "../movements-contract";

function extractVersion(data: unknown): number {
  if (typeof data === "object" && data !== null && "version" in data) {
    const v = (data as { version?: unknown }).version;
    if (typeof v === "number" && Number.isSafeInteger(v) && v >= 1) return v;
  }
  return invalidResponse();
}

export function useInventoryMovements() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authKey = useAuthScopeKey(user);
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const scopeKey = JSON.stringify([authKey, realtimeAuthGeneration, scope.headers]);
  const scopeOwner = useMemo(() => ({ scopeKey }), [scopeKey]);
  const [sessionLedger, setSessionLedger] = useState<(SessionMovementEntry & { scopeOwner: object })[]>([]);
  const { pending, formError, setFormError, hasUnresolvedWrite, retryUnresolved, run, post } = useMovementCommandRunner(scope.headers, scopeKey);

  const can = useCallback(
    (permission: string) =>
      hasTradePermission(scope.permissions, scope.isTenantOwner, permission),
    [scope.permissions, scope.isTenantOwner],
  );

  const { knownNodes, nodesError } = useMovementNodes(scope.headers, scopeKey, scope.isResolved && can(INVENTORY_READ_PERMISSION));

  const appendLedger = useCallback((entry: SessionMovementEntry) => {
    setSessionLedger((prev) => [{ ...entry, scopeKey, scopeOwner }, ...prev.filter((item) => item.id !== entry.id && item.scopeOwner === scopeOwner)]);
  }, [scopeKey, scopeOwner]);

  const updateLedgerStatus = useCallback(
    (id: string, status: SessionMovementEntry["status"], nextVersion: number, data?: unknown) => {
      const lines = record(data)?.lines ? parseMovementLines(data) : undefined;
      setSessionLedger((prev) => {
        const target = prev.find(item => item.id === id && item.scopeOwner === scopeOwner);
        // Posting consumes and versions these reservations; no reservation GET exists.
        const consumed = status === "POSTED" && target?.kind === "delivery" ? target.reservationIds ?? [] : [];
        return prev.map((item) =>
          item.id === id && item.scopeOwner === scopeOwner
            ? {
                ...item,
                status,
                version: nextVersion,
                ...(lines ? { lines } : {}),
              }
            : item.scopeOwner === scopeOwner && item.kind === "reservation" && consumed.includes(item.id)
              ? { ...item, stale: true } : item,
        );
      });
    },
    [scopeOwner],
  );


  return {
    t,
    lang,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    sessionLedger: sessionLedger.filter(entry => entry.scopeOwner === scopeOwner),
    knownNodes,
    headers: scope.headers, scopeKey,
    canReadSales: can("trade.sales_orders.read"),
    canReadPurchases: can("trade.purchase_orders.read"),
    pending,
    hasUnresolvedWrite,
    retryUnresolved,
    formError: formError ?? nodesError,
    clearError: () => setFormError(null),
    canOpeningBalance: can(INVENTORY_OPENING_BALANCE_PERMISSION),
    canReserve: can(INVENTORY_RESERVE_PERMISSION),
    canReceive: can(INVENTORY_RECEIVE_PERMISSION),
    canDeliver: can(INVENTORY_DELIVER_PERMISSION),
    // Reversal is `trade.inventory.adjust`, not the movement's own grant: a
    // user who can post cannot necessarily undo.
    canAdjust: can(INVENTORY_ADJUST_PERMISSION),

    submitOpeningBalance: (values: OpeningBalanceFormValues) =>
      run(
        "openingBalance",
        () => post(INVENTORY_OPENING_BALANCES_PATH, buildOpeningBalanceRequest(values)),
        (data) => {
          const result = record(data);
          const ledger = record(result?.ledger);
          if (!ledger) invalidResponse();
          const id = parseMovementId(ledger);
          appendLedger({
            id,
            kind: "openingBalance",
            businessEffectiveAt: new Date(values.businessEffectiveAt.trim()).toISOString(),
            nodeId: values.nodeId.trim(),
            summary: `${formatDecimalString(values.quantity, lang, { maximumFractionDigits: 8 })} ${values.display?.unitLabel ?? t.tradeInventory.quantity}`,
            display: values.display,
            version: extractVersion(ledger),
            status: "POSTED",
            recordedAt: new Date().toISOString(),
          });
        },
      ),

    submitReservation: (values: ReservationFormValues) =>
      run(
        "reservation",
        () => post(INVENTORY_RESERVATIONS_PATH, buildReservationRequest(values)),
        (data) => {
          const reservation = parseReservation(data);
          const { id, version, status } = reservation;
          appendLedger({
            id,
            kind: "reservation",
            nodeId: values.nodeId.trim(),
            summary: values.display?.itemLabel ?? t.tradeInventory.reservationTab,
            display: values.display, requestedQuantity: values.quantity,
            sourceDocumentId: values.sourceDocumentId, sourceLineId: values.sourceLineId,
            serialKeys: splitSerialInput(values.serialKeys ?? ""),
            version,
            status,
            reservation,
            recordedAt: new Date().toISOString(),
          });
        },
      ),

    releaseReservation: (id: string, version: number, quantity: string, reasonCode: string, serialKeys = "") =>
      run(
        "release",
        () => post(reservationReleasePath(id), buildReleaseRequest(quantity, reasonCode, serialKeys), version),
        (data) => {
          const reservation = parseReservation(data, id.trim());
          const previous = sessionLedger.find((entry) => entry.id === reservation.id && entry.scopeOwner === scopeOwner);
          appendLedger({
            id: reservation.id,
            kind: "reservation",
            nodeId: reservation.fulfillmentNodeId,
            summary: previous?.summary ?? t.tradeInventory.reservationTab,
            display: previous?.display, sourceDocumentId: previous?.sourceDocumentId,
            sourceLineId: previous?.sourceLineId, serialKeys: previous?.serialKeys,
            version: reservation.version,
            status: reservation.status,
            reservation,
            recordedAt: previous?.recordedAt ?? new Date().toISOString(),
          });
        },
      ),

    submitReceipt: (values: MovementFormValues) =>
      run(
        "receipt",
        () => post(INVENTORY_RECEIPTS_PATH, buildReceiptRequest(values)),
        (data) => {
          const id = parseMovementId(data);
          const lines = parseMovementLines(data);
          if (parseMovementStatus(data) !== "DRAFT") invalidResponse();
          appendLedger({
            id,
            kind: "receipt",
            businessEffectiveAt: new Date(values.businessEffectiveAt.trim()).toISOString(),
            lines,
            nodeId: values.nodeId.trim(),
            summary: `${formatNumber(values.lines.length, lang)} ${t.tradeInventory.lines}`,
            display: values.display, sourceDocumentId: values.sourceDocumentId,
            version: extractVersion(data),
            status: "DRAFT",
            recordedAt: new Date().toISOString(),
          });
        },
      ),

    postReceipt: (id: string, version: number) =>
      run(
        "receiptPost",
        () => post(receiptActionPath(id, "post"), undefined, version),
        (data) => {
          const status = parseMovementStatus(data);
          if (parseMovementId(data) !== id.trim() || status !== "POSTED") invalidResponse();
          parseMovementLines(data);
          updateLedgerStatus(id.trim(), status, extractVersion(data), data);
        },
      ),

    reverseReceipt: (id: string, version: number, reasonCode: string, effectiveAt: string, lines: ReversalLineValues[] = []) =>
      run(
        "receiptReverse",
        () =>
          post(
            receiptActionPath(id, "reverse"),
            buildReversalRequest(reasonCode, effectiveAt, lines),
            version,
          ),
        (data) => {
          if (parseMovementId(data) !== id.trim() || !["PARTIALLY_REVERSED", "REVERSED"].includes(parseMovementStatus(data))) invalidResponse();
          parseMovementLines(data);
          updateLedgerStatus(id.trim(), parseMovementStatus(data), extractVersion(data), data);
        },
      ),

    submitDelivery: (values: MovementFormValues) =>
      run(
        "delivery",
        () => post(INVENTORY_DELIVERIES_PATH, buildDeliveryRequest(values)),
        (data) => {
          const id = parseMovementId(data);
          const lines = parseMovementLines(data);
          if (parseMovementStatus(data) !== "DRAFT") invalidResponse();
          appendLedger({
            id,
            kind: "delivery",
            businessEffectiveAt: new Date(values.businessEffectiveAt.trim()).toISOString(),
            reservationIds: values.lines.flatMap(line => line.reservationId ? [line.reservationId.trim()] : []),
            lines,
            nodeId: values.nodeId.trim(),
            summary: `${formatNumber(values.lines.length, lang)} ${t.tradeInventory.lines}`,
            display: values.display, sourceDocumentId: values.sourceDocumentId,
            version: extractVersion(data),
            status: "DRAFT",
            recordedAt: new Date().toISOString(),
          });
        },
      ),

    postDelivery: (id: string, version: number) =>
      run(
        "deliveryPost",
        () => post(deliveryActionPath(id, "post"), undefined, version),
        (data) => {
          const status = parseMovementStatus(data);
          if (parseMovementId(data) !== id.trim() || status !== "POSTED") invalidResponse();
          parseMovementLines(data);
          updateLedgerStatus(id.trim(), status, extractVersion(data), data);
        },
      ),

    reverseDelivery: (id: string, version: number, reasonCode: string, effectiveAt: string, lines: ReversalLineValues[] = []) =>
      run(
        "deliveryReverse",
        () =>
          post(
            deliveryActionPath(id, "reverse"),
            buildReversalRequest(reasonCode, effectiveAt, lines),
            version,
          ),
        (data) => {
          if (parseMovementId(data) !== id.trim() || !["PARTIALLY_REVERSED", "REVERSED"].includes(parseMovementStatus(data))) invalidResponse();
          parseMovementLines(data);
          updateLedgerStatus(id.trim(), parseMovementStatus(data), extractVersion(data), data);
        },
      ),
  };
}

