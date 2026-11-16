import {
  adminCan,
  adminCanAll,
  ADMIN_RBAC_CRITICAL,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { TenantBillingPermissions } from "../types";

export function readTenantBillingPermissions(
  user: AdminAuthorizationContext | null | undefined,
): TenantBillingPermissions {
  return {
    canReadSubscription: adminCan(user, "admin.subscriptions.read"),
    canCreateSubscription: adminCanAll(user, ADMIN_RBAC_CRITICAL.SUBSCRIPTIONS_CREATE),
    canUpdateSubscription: adminCan(user, "admin.subscriptions.update"),
    canApplySubscriptionUpdate: adminCanAll(user, ADMIN_RBAC_CRITICAL.SUBSCRIPTIONS_UPDATE),
    canCancelSubscription: adminCanAll(user, ADMIN_RBAC_CRITICAL.SUBSCRIPTIONS_CANCEL),
    canReadWallet: adminCan(user, "admin.wallet.read"),
    canPreviewWalletAdjustment: adminCan(user, "admin.wallet.manage"),
    canConfirmWalletAdjustment: adminCanAll(user, ADMIN_RBAC_CRITICAL.WALLET_MANAGE),
    canReadBillingSummary: adminCan(user, "admin.invoices.read"),
    canRecordOfflinePayment: adminCanAll(user, ADMIN_RBAC_CRITICAL.BILLING_PAYMENT_MANAGE),
    canRefundPayment: adminCanAll(user, ADMIN_RBAC_CRITICAL.BILLING_PAYMENT_MANAGE),
    canReconcilePayment: adminCan(user, "admin.billing.reconcile"),
    canDecideReconciliation: adminCanAll(user, ADMIN_RBAC_CRITICAL.BILLING_RECONCILE),
  };
}
