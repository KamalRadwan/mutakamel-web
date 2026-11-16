"use client";

import { Building2, Filter, RefreshCw, ShieldAlert, Truck, Users } from "lucide-react";
import { Button, EmptyState, PageHeader, PermissionGate, SummaryStrip } from "@/design-system";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { AccountInspectModal, CreateAccountDrawer, EditAccountDrawer } from "./components/AccountDrawers";
import { AccountFilters } from "./components/AccountFilters";
import { AccountResults } from "./components/AccountResults";
import { useAccountWorkspace } from "./hooks/useAccountWorkspace";

export default function TradeCommercialAccountsPage() {
  const workspace = useAccountWorkspace();
  const { t, copy, accounts, stats, inspecting, setInspecting } = workspace;
  return (
    <PermissionGate require={TRADE_PERMISSIONS.commercialAccountsRead}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <PageHeader className="sr-only" title={t.trade.accountsTitle} description={t.trade.accountsSubtitle}
          primaryAction={workspace.canEdit ? { label: t.trade.accountCreate, onClick: accounts.openCreate } : undefined}
          secondaryActions={<Button size="sm" variant="outline" onClick={() => void accounts.reload()} disabled={accounts.isRefreshing}>
            <RefreshCw className={accounts.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />{t.trade.reload}
          </Button>} />
        {!accounts.scopeGap && <SummaryStrip items={[
          { label: copy.totalAccounts, value: stats.total, description: copy.totalAccountsSub, icon: Building2, hue: "indigo" },
          { label: t.trade.accountRole_CUSTOMER, value: stats.customers, description: copy.customersSub, icon: Users, hue: "blue" },
          { label: t.trade.accountRole_SUPPLIER, value: stats.suppliers, description: copy.suppliersSub, icon: Truck, hue: "purple" },
          { label: t.trade.accountStatus_BLOCKED, value: stats.blocked, description: copy.blockedSub, icon: ShieldAlert, hue: "red" },
        ]} />}
        <TradeScopeBar hideWhenSingleScope />
        {accounts.scopeGap ? <EmptyState icon={Filter} title={t.trade.scopeRequiredTitle} description={t.trade.accountScopeRequiredDescription} /> : <>
          <AccountFilters workspace={workspace} />
          <AccountResults workspace={workspace} />
        </>}

        <CreateAccountDrawer
          key={accounts.createOpen ? "create-open" : "create-closed"}
          isOpen={accounts.createOpen}
          isSubmitting={accounts.isSubmitting}
          error={accounts.formError}
          onClose={accounts.closeCreate}
          onSubmit={accounts.create}
        />

        {accounts.editing ? (
          <EditAccountDrawer
            key={accounts.editing.id}
            account={accounts.editing}
            isSubmitting={accounts.isSubmitting}
            error={accounts.formError}
            onClose={accounts.closeEdit}
            onSubmit={accounts.update}
          />
        ) : null}

        <AccountInspectModal
          account={inspecting}
          canManage={accounts.canManage && !accounts.writeScopeGap}
          onClose={() => setInspecting(null)}
          onEdit={(account) => accounts.openEdit(account)}
        />
      </div>
    </PermissionGate>
  );
}
