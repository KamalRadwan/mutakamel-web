"use client";

import { useI18n } from "@/i18n/I18nContext";

export function useDashboardHome() {
  const { t } = useI18n();

  const adminUser = {
    firstName: t.common.adminUser.split(" ")[0] || "Mona",
    lastName: t.common.adminUser.split(" ")[1] || "Ali",
  };

  const kpiCards = [
    {
      id: "tenants",
      title: t.dashboard.totalTenants,
      value: "42",
      badgeText: "+12%",
      badgeTone: "emerald" as const,
      subText: t.dashboard.tenantsSubtext,
      iconType: "tenants" as const,
    },
    {
      id: "staff",
      title: t.dashboard.adminStaff,
      value: "18",
      badgeText: `+2 ${t.dashboard.thisMonth}`,
      badgeTone: "emerald" as const,
      subText: t.dashboard.staffSubtext,
      iconType: "staff" as const,
    },
    {
      id: "invoices",
      title: t.dashboard.pendingInvoices,
      value: "$1,299.00",
      badgeText: t.dashboard.invoicesCount,
      badgeTone: "amber" as const,
      subText: t.dashboard.invoicesSubtext,
      iconType: "invoices" as const,
    },
    {
      id: "capacity",
      title: t.dashboard.dbConsumption,
      value: "68%",
      badgeText: t.dashboard.serversCount,
      badgeTone: "purple" as const,
      subText: t.dashboard.capacitySubtext,
      iconType: "capacity" as const,
    },
  ];

  const handleCreateTenant = () => {
    // Navigate to tenant creation wizard
  };

  return {
    t,
    adminUser,
    kpiCards,
    handleCreateTenant,
  };
}
