"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchWorkspace } from "./components/search-workspace";

// Global record search — MASTER-PLAN 13.21. `CommandPalette` searches the nav
// tree; this searches records, and the two are deliberately separate surfaces.
//
// The term is a query parameter so a result set is linkable and survives
// back/forward. `useSearchParams` suspends during prerender, so the boundary
// below is required rather than decorative.

function GlobalSearchScreen() {
  const searchParams = useSearchParams();
  return <SearchWorkspace initialTerm={searchParams.get("q") ?? ""} />;
}

export default function GlobalSearchPage() {
  return (
    <Suspense fallback={null}>
      <GlobalSearchScreen />
    </Suspense>
  );
}
