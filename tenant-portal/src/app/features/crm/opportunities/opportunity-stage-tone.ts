import type { OpportunityStageFlag } from './opportunities.model';

export type StageTone = 'brand' | 'neutral' | 'success' | 'danger';

export function stageTone(flag: OpportunityStageFlag): StageTone {
  switch (flag) {
    case 'WON':
      return 'success';
    case 'LOST':
      return 'danger';
    case 'ON_HOLD':
      return 'neutral';
    default:
      return 'brand';
  }
}

export function isTerminalFlag(flag: OpportunityStageFlag): boolean {
  return flag === 'WON' || flag === 'LOST';
}
