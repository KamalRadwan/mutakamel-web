/**
 * Shared shape for feature-scoped bilingual copy dictionaries (the
 * `const en = {...}; const ar: CopyShape<typeof en> = {...}` pattern used by
 * several `src/features/admin/**\/copy.ts` files). Recurses into nested
 * groups so the Arabic object is type-checked against the English one's
 * exact key structure while every leaf stays a plain string.
 */
export type CopyShape<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : CopyShape<T[K]>;
};
