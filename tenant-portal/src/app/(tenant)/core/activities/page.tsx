"use client";

import { ActivitiesWorkspace } from "@/components/activities/workspace/ActivitiesWorkspace";

// Core's workspace lists and books activities on every application's records.
export default function CoreActivitiesPage() {
  return <ActivitiesWorkspace scope="ALL" />;
}
