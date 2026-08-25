import { describe, expect, it } from "vitest";
import { readTenantBillingPermissions } from "./permissions";

const user = (permissions: string[]) => ({ isSuperAdmin: false, permissions });

describe("tenant billing permission matrix", () => {
  it("requires every critical permission pair", () => {
    const partial = readTenantBillingPermissions(
      user([
        "admin.subscriptions.create",
        "admin.subscriptions.update",
        "admin.wallet.manage",
        "admin.billing.reconcile",
      ]),
    );
    expect(partial.canCreateSubscription).toBe(false);
    expect(partial.canUpdateSubscription).toBe(true);
    expect(partial.canApplySubscriptionUpdate).toBe(false);
    expect(partial.canPreviewWalletAdjustment).toBe(true);
    expect(partial.canConfirmWalletAdjustment).toBe(false);
    expect(partial.canRecordOfflinePayment).toBe(false);
    expect(partial.canReconcilePayment).toBe(true);
    expect(partial.canDecideReconciliation).toBe(false);
  });

  it("unlocks the paired actions only when critical permissions are present", () => {
    const complete = readTenantBillingPermissions(
      user([
        "admin.subscriptions.create",
        "admin.subscriptions.update",
        "admin.subscriptions.cancel",
        "admin.subscriptions.critical",
        "admin.wallet.read",
        "admin.wallet.manage",
        "admin.wallet.critical",
        "admin.billing.reconcile",
        "admin.billing.critical",
        "admin.invoices.read",
      ]),
    );
    expect(complete).toMatchObject({
      canCreateSubscription: true,
      canApplySubscriptionUpdate: true,
      canCancelSubscription: true,
      canReadWallet: true,
      canConfirmWalletAdjustment: true,
      canReadBillingSummary: true,
      canRecordOfflinePayment: true,
      canRefundPayment: true,
      canDecideReconciliation: true,
    });
  });
});
