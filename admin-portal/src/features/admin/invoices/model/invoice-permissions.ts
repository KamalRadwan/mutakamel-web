import {
  adminCan,
  adminCanAll,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { InvoicePermissions } from "../types/invoices";

export function readInvoicePermissions(
  user: AdminAuthorizationContext | null | undefined,
): InvoicePermissions {
  return {
    canRead: adminCan(user, "admin.invoices.read"),
    canCreate: adminCan(user, "admin.invoices.create"),
    canUpdate: adminCan(user, "admin.invoices.update"),
    canIssue: adminCanAll(user, [
      "admin.invoices.update",
      "admin.invoices.critical",
    ]),
    canVoid: adminCanAll(user, [
      "admin.invoices.void",
      "admin.invoices.critical",
    ]),
    canRecordOfflinePayment: adminCanAll(user, [
      "admin.wallet.manage",
      "admin.billing.critical",
    ]),
  };
}
