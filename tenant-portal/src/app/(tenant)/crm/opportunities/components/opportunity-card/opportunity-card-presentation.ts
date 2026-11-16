export function opportunityProbabilityClass(probabilityPercent: number) {
  if (probabilityPercent < 50) return "text-destructive";
  if (probabilityPercent < 75) return "text-ember-700 dark:text-ember-300";
  return "text-success";
}
