/**
 * Scroll behavior for scrollIntoView / scrollTo: 'smooth', or 'auto' when the user asks for reduced motion.
 * Why: the global CSS reduced-motion rule does not reach JS-driven scrolling.
 */
export function smoothScrollBehavior(): ScrollBehavior {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'auto' : 'smooth';
}
