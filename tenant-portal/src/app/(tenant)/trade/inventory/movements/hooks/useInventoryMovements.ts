"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeIfMatch, tradePost } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  INVENTORY_ADJUST_PERMISSION,
  INVENTORY_DELIVER_PERMISSION,
  INVENTORY_DELIVERIES_PATH,
  INVENTORY_OPENING_BALANCES_PATH,
  INVENTORY_OPENING_BALANCE_PERMISSION,
  INVENTORY_RECEIPTS_PATH,
  INVENTORY_RECEIVE_PERMISSION,
  INVENTORY_RESERVATIONS_PATH,
  INVENTORY_RESERVE_PERMISSION,
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
} from "../movements-contract";

const MOVEMENT_RESPONSE_LIMIT_BYTES = 120_000;

/** What the last create returned, per family — the only handle on a movement. */
type CreatedIds = Partial<Record<MovementKind, string>>;

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

  const [created, setCreated] = useState<CreatedIds>({});
  const [pending, setPending] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const can = useCallback(
    (permission: string) =>
      hasTradePermission(scope.permissions, scope.isTenantOwner, permission),
    [scope.permissions, scope.isTenantOwner],
  );

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

  const remember = (kind: MovementKind) => (data: unknown) =>
    setCreated((current) => ({ ...current, [kind]: parseMovementId(data) }));

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
      run("openingBalance", () =>
        post(INVENTORY_OPENING_BALANCES_PATH, buildOpeningBalanceRequest(values)),
      ),

    submitReservation: (values: ReservationFormValues) =>
      run(
        "reservation",
        () => post(INVENTORY_RESERVATIONS_PATH, buildReservationRequest(values)),
        remember("reservation"),
      ),

    releaseReservation: (id: string, version: number, quantity: string, reasonCode: string) =>
      run("release", () =>
        post(reservationReleasePath(id), buildReleaseRequest(quantity, reasonCode), version),
      ),

    submitReceipt: (values: MovementFormValues) =>
      run(
        "receipt",
        () => post(INVENTORY_RECEIPTS_PATH, buildReceiptRequest(values)),
        remember("receipt"),
      ),

    postReceipt: (id: string, version: number) =>
      run("receiptPost", () => post(receiptActionPath(id, "post"), undefined, version)),

    reverseReceipt: (id: string, version: number, reasonCode: string, effectiveAt: string) =>
      run("receiptReverse", () =>
        post(
          receiptActionPath(id, "reverse"),
          buildReversalRequest(reasonCode, effectiveAt),
          version,
        ),
      ),

    submitDelivery: (values: MovementFormValues) =>
      run(
        "delivery",
        () => post(INVENTORY_DELIVERIES_PATH, buildDeliveryRequest(values)),
        remember("delivery"),
      ),

    postDelivery: (id: string, version: number) =>
      run("deliveryPost", () => post(deliveryActionPath(id, "post"), undefined, version)),

    reverseDelivery: (id: string, version: number, reasonCode: string, effectiveAt: string) =>
      run("deliveryReverse", () =>
        post(
          deliveryActionPath(id, "reverse"),
          buildReversalRequest(reasonCode, effectiveAt),
          version,
        ),
      ),
  };
}
