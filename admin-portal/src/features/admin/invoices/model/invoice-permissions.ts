import {
  adminCan,
  adminCanAll,
  ADMIN_RBAC_CRITICAL,
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
    canIssue: adminCanAll(user, ADMIN_RBAC_CRITICAL.INVOICES_ISSUE),
    canVoid: adminCanAll(user, ADMIN_RBAC_CRITICAL.INVOICES_VOID),
    canRecordOfflinePayment: adminCanAll(user, ADMIN_RBAC_CRITICAL.BILLING_PAYMENT_MANAGE),
  };
}
