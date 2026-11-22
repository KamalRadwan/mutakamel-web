export interface RecordBulkAction {
  id: string;
  labelKey: string;
  icon: string;
  tone: string;
  allowed: boolean;
  reasonKey?: string;
  danger?: boolean;
}

const TILE_BY_TONE: Record<string, string> = {
  blue: 'bg-icon-blue',
  navy: 'bg-icon-navy',
  teal: 'bg-icon-teal',
  green: 'bg-icon-green',
  orange: 'bg-icon-orange',
  amber: 'bg-icon-orange',
  red: 'bg-icon-red',
  violet: 'bg-icon-violet',
  gray: 'bg-icon-gray',
  'icon-blue': 'bg-icon-blue',
  'icon-navy': 'bg-icon-navy',
  'icon-teal': 'bg-icon-teal',
  'icon-green': 'bg-icon-green',
  'icon-orange': 'bg-icon-orange',
  'icon-red': 'bg-icon-red',
  'icon-violet': 'bg-icon-violet',
  'icon-gray': 'bg-icon-gray',
  'bg-icon-blue': 'bg-icon-blue',
  'bg-icon-navy': 'bg-icon-navy',
  'bg-icon-teal': 'bg-icon-teal',
  'bg-icon-green': 'bg-icon-green',
  'bg-icon-orange': 'bg-icon-orange',
  'bg-icon-red': 'bg-icon-red',
  'bg-icon-violet': 'bg-icon-violet',
  'bg-icon-gray': 'bg-icon-gray',
};

export function bulkTileClass(tone: string): string {
  return TILE_BY_TONE[tone] ?? 'bg-icon-blue';
}

export function isDangerBulkTone(tone: string): boolean {
  return tone === 'red' || tone === 'icon-red' || tone === 'bg-icon-red';
}
