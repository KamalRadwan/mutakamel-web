"use client";

import Link from "next/link";
import { Button, EmptyState, Field, PageHeader, PermissionGate, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { canAdoptDefinitions } from "../../subscription/definition-adoption-command";
import { useApplicationAccessScopes } from "../hooks/useApplicationAccessScopes";

export function ApplicationAccessScopes() {
  const { t, allowed, companies, branches, companyOptions, branchOptions, open, pending } = useApplicationAccessScopes();
  const { user, isAuthenticated } = useTenantAuth();
  const canAdopt = isAuthenticated && canAdoptDefinitions(user);
  const copy = t.applicationAccess;
  return <div className="flex min-w-0 flex-col gap-4">
    {canAdopt && <div><Button size="sm" variant="outline" asChild><Link href={TENANT_ROUTES.coreSubscriptionDefinitionAdoption}>{t.commercialAdoption.open}</Link></Button></div>}
    <PermissionGate require={[]} denied={!allowed}>
    <div className="flex flex-col gap-4">
      <PageHeader className="sr-only" title={copy.title} description={copy.scopeDiscoveryNotice} />
      {companies.length + branches.length === 0 ? <EmptyState title={copy.noScopes} description={copy.noScopesDescription} /> : (
        <div className="max-w-xl">
          <Field label={copy.chooseScope} hint={copy.exactScopeNotice}>
            <Select value="" onValueChange={open} disabled={pending}>
              <SelectTrigger textSize="compact" size="sm"><SelectValue /></SelectTrigger>
              <SelectContent textSize="compact">
                {companies.length > 0 && <SelectGroup><SelectLabel>{copy.company}</SelectLabel>
                  {companyOptions.map(({ value, label }) => <SelectItem key={value} value={`companies:${value}`}><bdi>{label}</bdi></SelectItem>)}
                </SelectGroup>}
                {branches.length > 0 && <SelectGroup><SelectLabel>{copy.branch}</SelectLabel>
                  {branchOptions.map(({ value, label }) => <SelectItem key={value} value={`branches:${value}`}><bdi>{label}</bdi></SelectItem>)}
                </SelectGroup>}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </div>
  </PermissionGate></div>;
}
