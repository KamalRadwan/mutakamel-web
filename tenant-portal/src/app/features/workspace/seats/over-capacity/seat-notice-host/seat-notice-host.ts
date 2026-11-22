import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleX, tablerInfoCircle, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ModuleUsage } from '../../seats.model';
import { OverCapacityNotice, formatSeatDate, moduleDisplayName } from '../over-capacity-notice.service';

type NoticeKind = 'grace' | 'over' | 'me';

interface NoticeCard {
  kind: NoticeKind;
  icon: string;
  circle: string;
  titleKey: string;
  textKey: string;
  textParams: Record<string, unknown>;
  actionKey: string | null;
  moduleKey: string | null;
}

const DISMISS_STORAGE_PREFIX = 'seat-notice-dismissed:';

function readDismissed(kind: NoticeKind): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_STORAGE_PREFIX}${kind}`) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(kind: NoticeKind): void {
  try {
    sessionStorage.setItem(`${DISMISS_STORAGE_PREFIX}${kind}`, '1');
  } catch {
    // Ignore storage errors when sessionStorage is unavailable.
  }
}

function joinModuleNames(modules: readonly ModuleUsage[], lang: 'en' | 'ar'): string {
  const separator = lang === 'ar' ? '، ' : ', ';
  return modules.map((module) => moduleDisplayName(module, lang)).join(separator);
}

function earliestIso(values: readonly (string | null)[]): string | null {
  let best: string | null = null;
  let bestTime = Infinity;
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      if (best === null) best = value;
      continue;
    }
    if (parsed < bestTime) {
      bestTime = parsed;
      best = value;
    }
  }
  return best;
}

@Component({
  selector: 'app-seat-notice-host',
  imports: [NgIcon, RouterLink, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'seats-over-capacity', alias: 'oc' }, { scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerAlertTriangle, tablerCircleX, tablerInfoCircle, tablerX }),
  ],
  templateUrl: './seat-notice-host.html',
})
export class SeatNoticeHost {
  private readonly notice = inject(OverCapacityNotice);
  private readonly language = inject(LanguageState).current;
  protected readonly notify = inject(Notify);

  private readonly dismissed = signal<Record<NoticeKind, boolean>>({
    grace: readDismissed('grace'),
    over: readDismissed('over'),
    me: readDismissed('me'),
  });

  protected readonly cards = computed<NoticeCard[]>(() => {
    const lang = this.language();
    const hidden = this.dismissed();
    const list: NoticeCard[] = [];

    const graceModules = this.notice.graceModules();
    if (!hidden.grace && graceModules.length > 0) {
      const totalCapacity = graceModules.reduce((sum, module) => sum + module.capacity, 0);
      const graceIso = earliestIso(graceModules.map((module) => module.graceUntil));
      list.push({
        kind: 'grace',
        icon: 'tablerAlertTriangle',
        circle: 'bg-warning text-on-warning',
        titleKey: 'oc.grace.title',
        textKey: 'oc.grace.text',
        textParams: {
          module: joinModuleNames(graceModules, lang),
          capacity: totalCapacity,
          date: formatSeatDate(graceIso, lang),
        },
        actionKey: 'oc.grace.action',
        moduleKey: graceModules[0].moduleKey,
      });
    }

    const overModules = this.notice.overCapacityModules();
    if (!hidden.over && overModules.length > 0) {
      const totalOver = overModules.reduce(
        (sum, module) => sum + Math.max(module.overCapacity, Math.max(0, module.used - module.capacity)),
        0,
      );
      list.push({
        kind: 'over',
        icon: 'tablerCircleX',
        circle: 'bg-danger text-on-danger',
        titleKey: 'oc.over.title',
        textKey: 'oc.over.text',
        textParams: {
          n: totalOver,
          module: joinModuleNames(overModules, lang),
        },
        actionKey: 'oc.over.action',
        moduleKey: overModules[0].moduleKey,
      });
    }

    const myModules = this.notice.myReadOnlyModules();
    if (!hidden.me && myModules.length > 0) {
      list.push({
        kind: 'me',
        icon: 'tablerInfoCircle',
        circle: 'bg-brand text-on-brand',
        titleKey: 'oc.me.title',
        textKey: 'oc.me.text',
        textParams: {
          module: joinModuleNames(myModules, lang),
        },
        actionKey: null,
        moduleKey: null,
      });
    }

    return list;
  });

  constructor() {
    this.notice.start();
  }

  protected dismiss(kind: NoticeKind): void {
    writeDismissed(kind);
    this.dismissed.update((current) => ({ ...current, [kind]: true }));
  }
}
