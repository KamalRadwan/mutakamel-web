"use client";

import Link from "next/link";
import { Button, EmptyState, Field, IdentifierText, PageHeader, PermissionGate, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { DEFINITION_ADOPTION_PERMISSION } from "../../subscription/definition-adoption-command";
import { useApplicationAccessScopes } from "../hooks/useApplicationAccessScopes";

export function ApplicationAccessScopes() {
  const { t, allowed, companies, branches, open, pending } = useApplicationAccessScopes();
  const { user, isAuthenticated } = useTenantAuth();
  const canAdopt = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes(DEFINITION_ADOPTION_PERMISSION));
  const copy = t.applicationAccess;
  return <div className="flex min-w-0 flex-col gap-4">
    {canAdopt && <div><Button variant="outline" asChild><Link href={TENANT_ROUTES.coreSubscriptionDefinitionAdoption}>{t.commercialAdoption.open}</Link></Button></div>}
    <PermissionGate require={[]} denied={!allowed}>
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} description={copy.scopeDiscoveryNotice} />
      {companies.length + branches.length === 0 ? <EmptyState title={copy.noScopes} description={copy.noScopesDescription} /> : (
        <div className="max-w-xl">
          <Field label={copy.chooseScope} hint={copy.exactScopeNotice}>
            <Select value="" onValueChange={open} disabled={pending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {companies.length > 0 && <SelectGroup><SelectLabel>{copy.company}</SelectLabel>
                  {companies.map((id) => <SelectItem key={id} value={`companies:${id}`}><IdentifierText>{id}</IdentifierText></SelectItem>)}
                </SelectGroup>}
                {branches.length > 0 && <SelectGroup><SelectLabel>{copy.branch}</SelectLabel>
                  {branches.map((id) => <SelectItem key={id} value={`branches:${id}`}><IdentifierText>{id}</IdentifierText></SelectItem>)}
                </SelectGroup>}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </div>
  </PermissionGate></div>;
}
