/** CRM Lead/Customer/Opportunity DTOs accept integer ratings from zero to three. */
export const MAX_CRM_RATING = 3;

export const CRM_RATING_STARS: readonly number[] = Array.from(
  { length: MAX_CRM_RATING },
  (_, index) => index + 1,
);
