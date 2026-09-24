"use client";

import { ActivitiesWorkspace } from "@/components/activities/workspace/ActivitiesWorkspace";

// The same Core activity hub, narrowed to activities on CRM records.
export default function CrmActivitiesPage() {
  return <ActivitiesWorkspace scope="CRM" />;
}
