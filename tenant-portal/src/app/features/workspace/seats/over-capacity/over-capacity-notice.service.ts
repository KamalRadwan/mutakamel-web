import { DOCUMENT, DestroyRef, Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { StaffSession } from '../../staff/shared/staff-session';
import { getMySeatStates, getSeatUsage } from '../seats.api';
import { ModuleUsage, SeatAccessState, SeatUsage } from '../seats.model';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function isModuleOverCapacity(module: ModuleUsage): boolean {
  return module.overCapacity > 0 || module.overCapacitySince !== null;
}

export function isModuleInGrace(module: ModuleUsage): boolean {
  if (isModuleOverCapacity(module) || module.graceUntil === null) return false;
  const graceTime = Date.parse(module.graceUntil);
  return module.used > module.capacity || (!Number.isNaN(graceTime) && graceTime > Date.now());
}

export function isModuleAffected(module: ModuleUsage): boolean {
  return isModuleInGrace(module) || isModuleOverCapacity(module);
}

export function formatSeatDate(iso: string | null | undefined, lang: 'en' | 'ar'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function moduleDisplayName(
  module: { moduleKey: string; nameI18n?: { en: string; ar: string } },
  lang: 'en' | 'ar',
): string {
  return lang === 'ar' ? (module.nameI18n?.ar || module.moduleKey) : (module.nameI18n?.en || module.moduleKey);
}

@Service()
export class OverCapacityNotice {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(StaffSession);

  get isOwner(): boolean {
    return this.session.isOwner();
  }
  readonly usage = signal<SeatUsage | null>(null);
  readonly myStates = signal<{ moduleKey: string; accessState: SeatAccessState }[]>([]);

  readonly ownerNotices = computed<ModuleUsage[]>(() => {
    if (!this.isOwner) return [];
    return (this.usage()?.modules ?? []).filter(isModuleAffected);
  });

  readonly graceModules = computed<ModuleUsage[]>(() => this.ownerNotices().filter(isModuleInGrace));

  readonly overCapacityModules = computed<ModuleUsage[]>(() => this.ownerNotices().filter(isModuleOverCapacity));

  readonly myReadOnlyModules = computed<ModuleUsage[]>(() => {
    const byKey = new Map((this.usage()?.modules ?? []).map((module) => [module.moduleKey, module]));
    return this.myStates()
      .filter((state) => state.accessState === 'OVER_CAPACITY')
      .map(
        (state) =>
          byKey.get(state.moduleKey) ?? {
            moduleKey: state.moduleKey,
            kind: 'ROLE_DERIVED' as const,
            nameI18n: { en: state.moduleKey.toUpperCase(), ar: state.moduleKey.toUpperCase() },
            capacity: 0,
            used: 0,
            overCapacity: 0,
            graceUntil: null,
            overCapacitySince: null,
            pendingCapacity: null,
          },
      );
  });

  private started = false;
  private refreshSeq = 0;
  private lastActorId: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const actorId = this.session.me()?.id ?? null;
      if (this.lastActorId === undefined) {
        this.lastActorId = actorId;
        return;
      }
      if (actorId === this.lastActorId) return;
      this.lastActorId = actorId;
      untracked(() => {
        this.myStates.set([]);
        void this.refresh();
      });
    });
  }

  start(): void {
    if (!this.started) {
      this.started = true;
      const win = this.document.defaultView;
      const onFocus = () => void this.refresh();
      const timer = win ? win.setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS) : null;
      win?.addEventListener('focus', onFocus);

      this.destroyRef.onDestroy(() => {
        if (timer !== null) win?.clearInterval(timer);
        win?.removeEventListener('focus', onFocus);
        this.started = false;
      });
    }

    void this.refresh();
  }

  async refresh(): Promise<void> {
    const seq = ++this.refreshSeq;
    try {
      const [usage, myStates] = await Promise.all([getSeatUsage(), getMySeatStates()]);
      if (seq !== this.refreshSeq) return;
      this.usage.set(usage);
      this.myStates.set(myStates);
    } catch {
      // Background status polling stays silent when the endpoint is temporarily unreachable.
    }
  }
}
