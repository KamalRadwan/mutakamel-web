import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLock } from '@ng-icons/tabler-icons';
import { SeatAccessState } from '../seats.model';

const KNOWN_MODULES = new Set<string>(['crm', 'trade', 'accounting']);

@Component({
  selector: 'app-seat-chips',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerLock }),
  ],
  templateUrl: './seat-chips.html',
  host: { class: 'inline-flex flex-wrap items-center gap-4' },
})
export class SeatChips {
  private readonly transloco = inject(TranslocoService);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));

  readonly seats = input.required<{ moduleKey: string; accessState: SeatAccessState }[]>();

  protected moduleLabel(moduleKey: string): string {
    this.seatsTranslation();
    if (KNOWN_MODULES.has(moduleKey)) {
      const key = `seats.module.${moduleKey}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return moduleKey;
  }
}
