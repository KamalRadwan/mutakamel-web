import { rmSync } from "node:fs";

// next build/dev regenerate tsconfig.json's include to reference these
// directories (see D7 in docs/build/DEFECTS.md), so `tsc --noEmit` picks up
// whatever was last generated for a route tree that may no longer match
// source. Clearing them first makes typecheck depend only on source.
for (const dir of [".next/types", ".next/dev/types"]) {
  rmSync(dir, { recursive: true, force: true });
}
