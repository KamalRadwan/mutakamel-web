import { InjectionToken } from '@angular/core';
import { TabLeaderConfig } from './tab-leader.model';

export const DEFAULT_TAB_LEADER_CONFIG: TabLeaderConfig = {
  lockName: 'mutakamel.tabs.leader',
  channelName: 'mutakamel.tabs',
  heartbeatMs: 2000,
  takeoverAfterMs: 6000,
  focusSettleMs: 400,
  handoverTimeoutMs: 3000,
  focusHandover: true,
};

export const TAB_LEADER_CONFIG = new InjectionToken<TabLeaderConfig>('TAB_LEADER_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_TAB_LEADER_CONFIG,
});
