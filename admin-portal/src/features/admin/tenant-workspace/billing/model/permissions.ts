import {
  adminCan,
  adminCanAll,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { TenantBillingPermissions } from "../types";

export function readTenantBillingPermissions(
  user: AdminAuthorizationContext | null | undefined,
): TenantBillingPermissions {
  return {
    canReadSubscription: adminCan(user, "admin.subscriptions.read"),
    canCreateSubscription: adminCanAll(user, [
      "admin.subscriptions.create",
      "admin.subscriptions.critical",
    ]),
    canUpdateSubscription: adminCan(user, "admin.subscriptions.update"),
    canApplySubscriptionUpdate: adminCanAll(user, [
      "admin.subscriptions.update",
      "admin.subscriptions.critical",
    ]),
    canCancelSubscription: adminCanAll(user, [
      "admin.subscriptions.cancel",
      "admin.subscriptions.critical",
    ]),
    canReadWallet: adminCan(user, "admin.wallet.read"),
    canPreviewWalletAdjustment: adminCan(user, "admin.wallet.manage"),
    canConfirmWalletAdjustment: adminCanAll(user, [
      "admin.wallet.manage",
      "admin.wallet.critical",
    ]),
    canReadBillingSummary: adminCan(user, "admin.invoices.read"),
    canRecordOfflinePayment: adminCanAll(user, [
      "admin.wallet.manage",
      "admin.billing.critical",
    ]),
    canRefundPayment: adminCanAll(user, [
      "admin.wallet.manage",
      "admin.billing.critical",
    ]),
    canReconcilePayment: adminCan(user, "admin.billing.reconcile"),
    canDecideReconciliation: adminCanAll(user, [
      "admin.billing.reconcile",
      "admin.billing.critical",
    ]),
  };
}
