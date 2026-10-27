"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateUUIDv7 } from "@/lib/uuid";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../../trade-advanced-scope";
import { normalizeApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  INVENTORY_ADJUST_PERMISSION,
  INVENTORY_DELIVER_PERMISSION,
  INVENTORY_DELIVERIES_PATH,
  INVENTORY_NODES_PATH,
  INVENTORY_OPENING_BALANCES_PATH,
  INVENTORY_OPENING_BALANCE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  INVENTORY_RECEIPTS_PATH,
  INVENTORY_RECEIVE_PERMISSION,
  INVENTORY_RESERVATIONS_PATH,
  INVENTORY_RESERVE_PERMISSION,
  invalidResponse,
  parseInventoryNode,
  type InventoryNode,
} from "../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";
import {
  buildDeliveryRequest,
  buildOpeningBalanceRequest,
  buildReceiptRequest,
  buildReleaseRequest,
  buildReservationRequest,
  buildReversalRequest,
  deliveryActionPath,
  parseMovementId,
  parseMovementLines,
  parseMovementStatus,
  parseReservation,
  receiptActionPath,
  reservationReleasePath,
  type MovementFormValues,
  type MovementKind,
  type OpeningBalanceFormValues,
  type ReservationFormValues,
  type ReversalLineValues,
  type SessionMovementEntry,
} from "../movements-contract";

const MOVEMENT_RESPONSE_LIMIT_BYTES = 120_000;

/** What the last create returned, per family — the only handle on a movement. */
type CreatedIds = Partial<Record<MovementKind, string>>;

function extractVersion(data: unknown, fallback = 1): number {
  if (typeof data === "object" && data !== null && "version" in data) {
    const v = (data as { version?: unknown }).version;
    if (typeof v === "number" && Number.isInteger(v) && v >= 1) return v;
  }
  return fallback;
}

/**
 * Every movement is a BRANCH-scoped write with no read route to follow it.
 *
 * The screen keeps the ids the server returned in session state because there
 * is no way to look them up again: `GET /inventory/receipts/:id` and its
 * siblings do not exist (Q37). A reload loses them, and the screen says so.
 */
export function useInventoryMovements() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [created, setCreated] = useState<CreatedIds>({});
  const [sessionLedger, setSessionLedger] = useState<SessionMovementEntry[]>([]);
  const [nodesResult, setNodesResult] = useState<{
    request: object;
    nodes: InventoryNode[];
    error: string | null;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const unresolved = useRef<{
    fingerprint: string;
    body: unknown;
    headers: Record<string, string>;
  } | null>(null);

  const can = useCallback(
    (permission: string) =>
      hasTradePermission(scope.permissions, scope.isTenantOwner, permission),
    [scope.permissions, scope.isTenantOwner],
  );

  const canReadNodes = can(INVENTORY_READ_PERMISSION);
  const nodesRequest = useMemo(
    () => ({ headers: scope.headers, isResolved: scope.isResolved, branchId, canReadNodes, t }),
    [scope.headers, scope.isResolved, branchId, canReadNodes, t],
  );
  // Hide the previous request's result during render, before the next effect runs.
  const currentNodesResult = nodesResult?.request === nodesRequest ? nodesResult : null;
  const knownNodes = currentNodesResult?.nodes ?? [];
  const nodesError = currentNodesResult?.error ?? null;

  useEffect(() => {
    if (!nodesRequest.isResolved || !nodesRequest.canReadNodes) return;
    const controller = new AbortController();
    void tradeGet(INVENTORY_NODES_PATH, {
      signal: controller.signal,
      headers: nodesRequest.headers,
      maxResponseBytes: MOVEMENT_RESPONSE_LIMIT_BYTES,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        setNodesResult({
          request: nodesRequest,
          nodes: parseTradeArray(res.data, parseInventoryNode, invalidResponse),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNodesResult({
          request: nodesRequest,
          nodes: [],
          error: inventoryMessage(normalizeApiError(error), nodesRequest.t) ?? inventoryFormMessage(error, nodesRequest.t),
        });
      });
    return () => controller.abort();
  }, [nodesRequest]);

  const run = useCallback(
    async (
      operation: string,
      call: () => Promise<{ headers: Headers; data: unknown }>,
      onSuccess?: (data: unknown) => void,
    ): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setPending(operation);
      setFormError(null);
      try {
        const response = await call();
        onSuccess?.(response.data);
        unresolved.current = null;
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeInventory.movementAccepted,
        );
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "INVENTORY_UNRESOLVED_WRITE") {
          setFormError(t.tradeInventory.unresolvedWrite);
          return false;
        }
        const normalized = normalizeApiError(error);
        // A client rejection resolves the write, including an unchanged retry.
        // Keep its identity only while transport/server failures or invalid
        // success payloads leave the outcome unknown.
        if (normalized.status >= 400 && normalized.status < 500) {
          unresolved.current = null;
        }
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t));
        return false;
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [toast, t],
  );

  const appendLedger = useCallback((entry: SessionMovementEntry) => {
    setSessionLedger((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
  }, []);

  const updateLedgerStatus = useCallback(
    (id: string, status: SessionMovementEntry["status"], nextVersion?: number) => {
      setSessionLedger((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                version: nextVersion ?? item.version + 1,
              }
            : item,
        ),
      );
    },
    [],
  );

  const post = (path: string, body: unknown, ifMatch?: number) => {
    // Business keys are generated by builders; compare the remaining payload
    // so an unchanged retry can reuse the original body and HTTP identity.
    const fingerprint = JSON.stringify([path, scope.headers, ifMatch, body], (key, value: unknown) =>
      key === "operationKey" || key === "intentKey" ? undefined : value,
    );
    if (unresolved.current && unresolved.current.fingerprint !== fingerprint) {
      throw new Error("INVENTORY_UNRESOLVED_WRITE");
    }
    unresolved.current ??= {
      fingerprint,
      body,
      headers: {
        ...scope.headers,
        ...(ifMatch === undefined ? {} : { "If-Match": tradeIfMatch(ifMatch) }),
        "x-idempotency-key": generateUUIDv7(),
      },
    };
    return tradePost(path as Parameters<typeof tradePost>[0], unresolved.current.body, {
      headers: unresolved.current.headers,
      maxResponseBytes: MOVEMENT_RESPONSE_LIMIT_BYTES,
    });
  };

  return {
    t,
    lang,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    created,
    sessionLedger,
    knownNodes,
    pending,
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
          const id =
            typeof data === "object" && data !== null && "id" in data && typeof (data as { id?: unknown }).id === "string"
              ? (data as { id: string }).id
              : `ob-${Date.now()}`;
          appendLedger({
            id,
            kind: "openingBalance",
            nodeId: values.nodeId.trim(),
            summary: `Item ${values.itemId.trim().slice(0, 8)} · Qty ${values.quantity.trim()}`,
            version: extractVersion(data, 1),
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
          setCreated((current) => ({ ...current, reservation: id }));
          appendLedger({
            id,
            kind: "reservation",
            nodeId: values.nodeId.trim(),
            summary: `Doc ${values.sourceDocumentId.trim().slice(0, 8)} · Qty ${values.quantity.trim()}`,
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
          const previous = sessionLedger.find((entry) => entry.id === reservation.id);
          appendLedger({
            id: reservation.id,
            kind: "reservation",
            nodeId: reservation.fulfillmentNodeId,
            summary: previous?.summary ?? t.tradeInventory.reservationTab,
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
          setCreated((current) => ({ ...current, receipt: id }));
          appendLedger({
            id,
            kind: "receipt",
            lines,
            nodeId: values.nodeId.trim(),
            summary: `PO ${values.sourceDocumentId.trim().slice(0, 8)} · ${values.lines.length} line(s)`,
            version: extractVersion(data, 1),
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
          updateLedgerStatus(id.trim(), "POSTED", extractVersion(data, version + 1));
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
          updateLedgerStatus(id.trim(), parseMovementStatus(data), extractVersion(data, version + 1));
        },
      ),

    submitDelivery: (values: MovementFormValues) =>
      run(
        "delivery",
        () => post(INVENTORY_DELIVERIES_PATH, buildDeliveryRequest(values)),
        (data) => {
          const id = parseMovementId(data);
          const lines = parseMovementLines(data);
          setCreated((current) => ({ ...current, delivery: id }));
          appendLedger({
            id,
            kind: "delivery",
            lines,
            nodeId: values.nodeId.trim(),
            summary: `SO ${values.sourceDocumentId.trim().slice(0, 8)} · ${values.lines.length} line(s)`,
            version: extractVersion(data, 1),
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
          updateLedgerStatus(id.trim(), "POSTED", extractVersion(data, version + 1));
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
          updateLedgerStatus(id.trim(), parseMovementStatus(data), extractVersion(data, version + 1));
        },
      ),
  };
}

