"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
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
  receiptActionPath,
  reservationReleasePath,
  type MovementFormValues,
  type MovementKind,
  type OpeningBalanceFormValues,
  type ReservationFormValues,
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
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);
  const companyScope = useTradeScope("COMPANY", branchId);

  const [created, setCreated] = useState<CreatedIds>({});
  const [sessionLedger, setSessionLedger] = useState<SessionMovementEntry[]>([]);
  const [knownNodes, setKnownNodes] = useState<InventoryNode[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const can = useCallback(
    (permission: string) =>
      hasTradePermission(scope.permissions, scope.isTenantOwner, permission),
    [scope.permissions, scope.isTenantOwner],
  );

  const canReadNodes = can(INVENTORY_READ_PERMISSION);

  useEffect(() => {
    if (!companyScope.isResolved || !canReadNodes) return;
    const controller = new AbortController();
    void tradeGet(INVENTORY_NODES_PATH, {
      signal: controller.signal,
      headers: companyScope.headers,
      maxResponseBytes: MOVEMENT_RESPONSE_LIMIT_BYTES,
    })
      .then((res) => {
        setKnownNodes(parseTradeArray(res.data, parseInventoryNode, invalidResponse));
      })
      .catch(() => {
        // Optional node picker enhancement; ignore errors silently.
      });
    return () => controller.abort();
  }, [companyScope.isResolved, companyScope.headers, canReadNodes]);

  const run = useCallback(
    async (
      operation: string,
      call: () => Promise<{ headers: Headers; data: unknown }>,
      onSuccess?: (data: unknown) => void,
    ): Promise<boolean> => {
      if (pending) return false;
      setPending(operation);
      setFormError(null);
      try {
        const response = await call();
        onSuccess?.(response.data);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeInventory.movementAccepted,
        );
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t));
        return false;
      } finally {
        setPending(null);
      }
    },
    [pending, toast, t],
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

  const post = (path: string, body: unknown, ifMatch?: number) =>
    tradePost(path as Parameters<typeof tradePost>[0], body, {
      headers: {
        ...scope.headers,
        ...(ifMatch === undefined ? {} : { "If-Match": tradeIfMatch(ifMatch) }),
      },
      maxResponseBytes: MOVEMENT_RESPONSE_LIMIT_BYTES,
    });

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
    formError,
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
          const id = parseMovementId(data);
          setCreated((current) => ({ ...current, reservation: id }));
          appendLedger({
            id,
            kind: "reservation",
            nodeId: values.nodeId.trim(),
            summary: `Doc ${values.sourceDocumentId.trim().slice(0, 8)} · Qty ${values.quantity.trim()}`,
            version: extractVersion(data, 1),
            status: "ACTIVE",
            recordedAt: new Date().toISOString(),
          });
        },
      ),

    releaseReservation: (id: string, version: number, quantity: string, reasonCode: string) =>
      run(
        "release",
        () => post(reservationReleasePath(id), buildReleaseRequest(quantity, reasonCode), version),
        (data) => {
          updateLedgerStatus(id.trim(), "RELEASED", extractVersion(data, version + 1));
        },
      ),

    submitReceipt: (values: MovementFormValues) =>
      run(
        "receipt",
        () => post(INVENTORY_RECEIPTS_PATH, buildReceiptRequest(values)),
        (data) => {
          const id = parseMovementId(data);
          setCreated((current) => ({ ...current, receipt: id }));
          appendLedger({
            id,
            kind: "receipt",
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

    reverseReceipt: (id: string, version: number, reasonCode: string, effectiveAt: string) =>
      run(
        "receiptReverse",
        () =>
          post(
            receiptActionPath(id, "reverse"),
            buildReversalRequest(reasonCode, effectiveAt),
            version,
          ),
        (data) => {
          updateLedgerStatus(id.trim(), "REVERSED", extractVersion(data, version + 1));
        },
      ),

    submitDelivery: (values: MovementFormValues) =>
      run(
        "delivery",
        () => post(INVENTORY_DELIVERIES_PATH, buildDeliveryRequest(values)),
        (data) => {
          const id = parseMovementId(data);
          setCreated((current) => ({ ...current, delivery: id }));
          appendLedger({
            id,
            kind: "delivery",
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

    reverseDelivery: (id: string, version: number, reasonCode: string, effectiveAt: string) =>
      run(
        "deliveryReverse",
        () =>
          post(
            deliveryActionPath(id, "reverse"),
            buildReversalRequest(reasonCode, effectiveAt),
            version,
          ),
        (data) => {
          updateLedgerStatus(id.trim(), "REVERSED", extractVersion(data, version + 1));
        },
      ),
  };
}

