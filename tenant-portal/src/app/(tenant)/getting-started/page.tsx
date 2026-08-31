"use client";

import { FirstRunChecklist } from "./components/first-run-checklist";

// First-run onboarding — MASTER-PLAN 13.23. A zero-data tenant currently lands
// on empty lists with no path forward; this names the next action, in order.
export default function GettingStartedPage() {
  return <FirstRunChecklist />;
}
