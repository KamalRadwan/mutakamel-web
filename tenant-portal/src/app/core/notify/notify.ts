import { Service, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  text: string;
  count: number;
}

const MAX_VISIBLE = 3;
const DURATION_MS: Record<ToastType, number | null> = { success: 4000, info: 4000, warning: 8000, error: null };

@Service()
export class Notify {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly deadlines = new Map<number, number>();
  private readonly remaining = new Map<number, number>();

  readonly toasts = signal<Toast[]>([]);

  success(title: string, text = '') {
    this.show('success', title, text);
  }

  error(title: string, text = '') {
    this.show('error', title, text);
  }

  warning(title: string, text = '') {
    this.show('warning', title, text);
  }

  info(title: string, text = '') {
    this.show('info', title, text);
  }

  durationOf(toast: Toast) {
    return DURATION_MS[toast.type];
  }

  /** Stops the auto-dismiss clock while the pointer or keyboard focus is on the toast (WCAG 2.2.1). */
  pause(id: number) {
    const deadline = this.deadlines.get(id);
    if (deadline === undefined || !this.timers.has(id)) return;
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.remaining.set(id, Math.max(deadline - Date.now(), 0));
  }

  resume(id: number) {
    const left = this.remaining.get(id);
    if (left === undefined) return;
    this.remaining.delete(id);
    this.schedule(id, left);
  }

  close(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.deadlines.delete(id);
    this.remaining.delete(id);
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(type: ToastType, title: string, text: string) {
    const repeat = this.toasts().find((toast) => toast.type === type && toast.title === title && toast.text === text);
    if (repeat) this.close(repeat.id);

    const toast: Toast = { id: this.nextId++, type, title, text, count: (repeat?.count ?? 0) + 1 };
    this.toasts.update((toasts) => [...toasts, toast].slice(-MAX_VISIBLE));

    const duration = DURATION_MS[type];
    if (duration !== null) this.schedule(toast.id, duration);
  }

  private schedule(id: number, ms: number) {
    this.deadlines.set(id, Date.now() + ms);
    this.timers.set(id, setTimeout(() => this.close(id), ms));
  }
}
