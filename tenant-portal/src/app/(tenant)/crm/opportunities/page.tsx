"use client";

import { PermissionGate } from "@/design-system";
import { OpportunitiesWorkspace } from "./components/opportunities-workspace";

// A CRM route is reachable by direct URL even when the sidebar hides it, so
// the 403 is reachable in-body and gets the mandated surface rather than a
// load error — AGENTS.md, docs/design/states.md. The permission string and
// its scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
export default function OpportunitiesPage() {
  return (
    <PermissionGate require="crm.opportunities.read" scoped>
      <OpportunitiesWorkspace />
    </PermissionGate>
  );
}
