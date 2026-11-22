import { Service, Signal, WritableSignal, isDevMode, signal } from '@angular/core';
import { TabChannelMessage } from './tab-leader.model';

type TopicHandler = (payload: unknown, fromTabId: string) => void;

/**
 * Typed cross-tab message bus backed by BroadcastChannel.
 *
 * Topic payloads must be structured-cloneable because BroadcastChannel
 * transfers values via the structured clone algorithm.
 */
@Service()
export class TabBus {
  private channel: BroadcastChannel | null = null;
  private tabId = '';
  private isLeaderFn: () => boolean = () => false;
  private onControlFn: ((msg: TabChannelMessage) => void) | null = null;

  private readonly publishedValues = new Map<string, unknown>();
  private readonly topicSignals = new Map<string, WritableSignal<unknown>>();
  private readonly handlers = new Map<string, Set<TopicHandler>>();

  /**
   * Leader only; no-op elsewhere. Stores the payload as the topic's last value
   * and delivers it to every tab (including local subscribers).
   */
  publish<T>(topic: string, payload: T): void {
    if (!this.isLeaderFn()) return;

    this.storePublished(topic, payload);
    this.deliverToHandlers(topic, payload, this.tabId);
    this.post({ v: 1, kind: 'publish', topic, payload, from: this.tabId });
  }

  /**
   * Any tab -> the leader. When called on the leader, delivers locally.
   */
  send<T>(topic: string, payload: T): void {
    if (this.isLeaderFn()) {
      this.deliverToHandlers(topic, payload, this.tabId);
      return;
    }
    this.post({ v: 1, kind: 'send', topic, payload, from: this.tabId });
  }

  /**
   * Subscribes to messages for `topic`. Returns an unregister function.
   */
  on<T>(topic: string, handler: (payload: T, fromTabId: string) => void): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set<TopicHandler>();
      this.handlers.set(topic, set);
    }

    const wrapped: TopicHandler = (payload, fromTabId) => {
      handler(payload as T, fromTabId);
    };
    set.add(wrapped);

    return () => {
      const current = this.handlers.get(topic);
      if (!current) return;
      current.delete(wrapped);
      if (current.size === 0) {
        this.handlers.delete(topic);
      }
    };
  }

  /**
   * Returns a read-only signal of the last published value for `topic` in every tab.
   */
  state<T>(topic: string): Signal<T | null> {
    let sig = this.topicSignals.get(topic);
    if (!sig) {
      const initial = this.publishedValues.has(topic) ? this.publishedValues.get(topic) : null;
      sig = signal<unknown>(initial);
      this.topicSignals.set(topic, sig);
    }
    return sig.asReadonly() as Signal<T | null>;
  }

  /**
   * Any tab -> every other tab (for notices such as a lost call).
   */
  broadcast<T>(topic: string, payload: T): void {
    this.post({ v: 1, kind: 'broadcast', topic, payload, from: this.tabId });
  }

  /** @internal Called by TabLeader to avoid a circular DI dependency. */
  bindLeader(tabId: string, isLeaderFn: () => boolean, onControl: (msg: TabChannelMessage) => void): void {
    this.tabId = tabId;
    this.isLeaderFn = isLeaderFn;
    this.onControlFn = onControl;
  }

  /** @internal */
  openChannel(channelName: string): void {
    this.closeChannel();
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      this.handleMessage(event.data);
    };
    this.channel = channel;
  }

  /** @internal */
  closeChannel(): void {
    if (!this.channel) return;
    this.channel.onmessage = null;
    this.channel.close();
    this.channel = null;
  }

  /** @internal */
  postControl(msg: TabChannelMessage): void {
    this.post(msg);
  }

  /** @internal */
  republishAll(): void {
    if (!this.isLeaderFn()) return;
    for (const [topic, payload] of this.publishedValues.entries()) {
      this.post({ v: 1, kind: 'publish', topic, payload, from: this.tabId });
    }
  }

  /** @internal */
  clearStoredTopics(): void {
    this.publishedValues.clear();
    for (const sig of this.topicSignals.values()) {
      sig.set(null);
    }
  }

  private storePublished(topic: string, payload: unknown): void {
    this.publishedValues.set(topic, payload);
    const sig = this.topicSignals.get(topic);
    if (sig) {
      sig.set(payload);
    }
  }

  private post(msg: TabChannelMessage): void {
    if (!this.channel) return;
    this.channel.postMessage(msg);
  }

  private handleMessage(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const msg = data as Partial<TabChannelMessage>;
    if (msg.v !== 1 || typeof msg.kind !== 'string' || typeof msg.from !== 'string') return;

    const validMsg = msg as TabChannelMessage;

    if (validMsg.kind.startsWith('tabs.')) {
      try {
        this.onControlFn?.(validMsg);
      } catch (err) {
        if (isDevMode()) {
          console.error('[tabs] control handler error', err);
        }
      }
      return;
    }

    if (typeof validMsg.topic !== 'string') return;

    switch (validMsg.kind) {
      case 'publish':
        this.storePublished(validMsg.topic, validMsg.payload);
        this.deliverToHandlers(validMsg.topic, validMsg.payload, validMsg.from);
        break;
      case 'send':
        if (this.isLeaderFn()) {
          this.deliverToHandlers(validMsg.topic, validMsg.payload, validMsg.from);
        }
        break;
      case 'broadcast':
        this.deliverToHandlers(validMsg.topic, validMsg.payload, validMsg.from);
        break;
    }
  }

  private deliverToHandlers(topic: string, payload: unknown, fromTabId: string): void {
    const set = this.handlers.get(topic);
    if (!set || set.size === 0) return;

    for (const handler of [...set]) {
      try {
        handler(payload, fromTabId);
      } catch (err) {
        if (isDevMode()) {
          console.error(`[tabs] handler error on topic "${topic}"`, err);
        }
      }
    }
  }
}
