export type TabRole = 'electing' | 'leader' | 'follower';
export type HandoverGuard = () => boolean;            // true = handover allowed now
export type StandDownHook = () => Promise<void>;     // stop what only a leader may run

export interface TabLeaderConfig {
  lockName: string;          // 'mutakamel.tabs.leader'
  channelName: string;       // 'mutakamel.tabs'
  heartbeatMs: number;       // 2000
  takeoverAfterMs: number;   // 6000
  focusSettleMs: number;     // 400
  handoverTimeoutMs: number; // 3000
  focusHandover: boolean;    // true
}

export type TabControlKind =
  | 'tabs.leader'
  | 'tabs.hello'
  | 'tabs.alive'
  | 'tabs.heartbeat'
  | 'tabs.leader-closing'
  | 'tabs.handover-request'
  | 'tabs.handover-denied'
  | 'tabs.handover-ok'
  | 'tabs.guards-clear';

export type TabMessageKind = 'publish' | 'send' | 'broadcast' | TabControlKind;

/**
 * Envelope sent over BroadcastChannel between tabs.
 * All payloads must be structured-cloneable (no functions, DOM nodes, or symbols).
 */
export interface TabChannelMessage<T = unknown> {
  v: 1;
  kind: TabMessageKind;
  topic?: string;
  payload?: T;
  from: string;
  to?: string;
  reason?: string;
}
