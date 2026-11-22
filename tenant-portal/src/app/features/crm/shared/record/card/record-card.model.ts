export { CARD_COLORS } from '../fields/record-fields.model';
export type { CardColor } from '../fields/record-fields.model';

export type DueBucket = 'OVERDUE' | 'TODAY' | 'FUTURE';

export const DUE_BADGE: Record<DueBucket | 'NONE', string> = {
  OVERDUE: 'bg-danger text-on-danger',
  TODAY: 'bg-warning text-on-warning',
  FUTURE: 'bg-success text-on-success',
  NONE: 'bg-neutral-soft text-on-neutral-soft',
};

export const STARS = [1, 2, 3];

export interface RecordCardOwner {
  name: string;
  avatarUrl?: string | null;
}

export function ownerInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
