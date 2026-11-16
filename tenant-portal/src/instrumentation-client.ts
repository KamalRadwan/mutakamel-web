import { z } from "zod";

// Runs before any client module. The CSP has no 'unsafe-eval', so zod's JIT
// probe (`Function("")`) is only a blocked-eval report; jitless skips the probe.
// The setting lives on globalThis, so it covers every bundled zod copy.
z.config({ jitless: true });
