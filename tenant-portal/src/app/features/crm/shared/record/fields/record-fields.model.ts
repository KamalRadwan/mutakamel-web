export interface Option {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

export interface OptionGroup {
  id: string;
  label: string;
  options: Option[];
}

export type CardColor =
  | 'RED'
  | 'ORANGE'
  | 'AMBER'
  | 'YELLOW'
  | 'GREEN'
  | 'TEAL'
  | 'BLUE'
  | 'INDIGO'
  | 'PURPLE'
  | 'PINK'
  | 'SLATE';

export const CARD_COLORS: Record<CardColor, string> = {
  RED: 'bg-chart-5',
  ORANGE: 'bg-chart-9',
  AMBER: 'bg-warning',
  YELLOW: 'bg-chart-4',
  GREEN: 'bg-chart-3',
  TEAL: 'bg-chart-8',
  BLUE: 'bg-chart-1',
  INDIGO: 'bg-chart-10',
  PURPLE: 'bg-chart-6',
  PINK: 'bg-chart-7',
  SLATE: 'bg-icon-gray',
};

export interface OwnerOption {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface CurrencyOption extends Option {
  decimals?: number;
  isDefault?: boolean;
}
