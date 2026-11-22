import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerApps,
  tablerCalculator,
  tablerClock,
  tablerShoppingCart,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ModuleUsage, SeatUsage, moduleNameIn, moduleTileOf } from '../seats.model';

const KNOWN_MODULES = new Set<string>(['crm', 'trade', 'accounting']);

@Component({
  selector: 'app-usage-bars',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'seats', alias: 'seats' }),
    provideIcons({
      tablerUsers,
      tablerShoppingCart,
      tablerCalculator,
      tablerApps,
      tablerClock,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './usage-bars.html',
  host: { class: 'block' },
})
export class UsageBars {
  private readonly transloco = inject(TranslocoService);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;

  readonly usage = input.required<SeatUsage>();

  protected moduleLabel(mod: ModuleUsage): string {
    this.seatsTranslation();
    if (KNOWN_MODULES.has(mod.moduleKey)) {
      const key = `seats.module.${mod.moduleKey}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return moduleNameIn(mod.nameI18n, this.language());
  }

  protected tileOf(moduleKey: string) {
    return moduleTileOf(moduleKey);
  }

  protected barPercent(mod: ModuleUsage): number {
    if (mod.capacity <= 0) {
      return mod.used > 0 ? 100 : 0;
    }
    return Math.min(100, Math.round((mod.used / mod.capacity) * 100));
  }

  protected barTone(mod: ModuleUsage): string {
    if (mod.used > mod.capacity || mod.overCapacity > 0) {
      return 'bg-danger';
    }
    if (mod.capacity > 0 && mod.used / mod.capacity >= 0.9) {
      return 'bg-warning';
    }
    return 'bg-brand';
  }

  protected showGrace(mod: ModuleUsage): boolean {
    return mod.graceUntil !== null && mod.overCapacity === 0;
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}
