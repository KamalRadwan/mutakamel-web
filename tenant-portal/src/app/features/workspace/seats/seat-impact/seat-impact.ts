import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerApps,
  tablerCalculator,
  tablerChevronDown,
  tablerShoppingCart,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../../shared/ui/button/button';
import { previewSeats } from '../seats.api';
import {
  SeatChange,
  SeatPreview,
  SeatPreviewModule,
  moduleNameIn,
  moduleTileOf,
  seatInitials,
} from '../seats.model';

const SKELETON_ITEMS = [0, 1] as const;
const KNOWN_MODULES = new Set<string>(['crm', 'trade', 'accounting']);

@Component({
  selector: 'app-seat-impact',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope({ scope: 'seats', alias: 'seats' }),
    provideIcons({
      tablerUsers,
      tablerShoppingCart,
      tablerCalculator,
      tablerApps,
      tablerChevronDown,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './seat-impact.html',
  host: { class: 'block' },
})
export class SeatImpact {
  private readonly transloco = inject(TranslocoService);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;

  readonly changes = input<SeatChange[] | null>(null);
  readonly compact = input(false);
  readonly canBuySeats = input(false);
  readonly staticPreview = input<SeatPreview | null>(null);

  readonly blocking = output<boolean>();
  readonly blockingReason = output<string | null>();
  readonly preview = output<SeatPreview | null>();

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly previewData = signal<SeatPreview | null>(null);
  protected readonly expandedModules = signal<ReadonlySet<string>>(new Set());

  protected readonly visible = computed(
    () => this.staticPreview() !== null || this.changes() !== null,
  );
  protected readonly effectivePreview = computed(
    () => this.staticPreview() ?? this.previewData(),
  );

  private readonly isBlocked = computed<boolean>(() => {
    const precomputed = this.staticPreview();
    if (precomputed !== null) {
      return precomputed.mode !== 'MANUAL' && !precomputed.ok;
    }
    if (this.changes() === null) {
      return false;
    }
    if (this.loading() || this.failed()) {
      return true;
    }
    const data = this.previewData();
    if (!data) {
      return true;
    }
    return data.mode !== 'MANUAL' && !data.ok;
  });

  private readonly currentBlockingReason = computed<string | null>(() => {
    this.seatsTranslation();
    this.language();
    if (!this.isBlocked()) {
      return null;
    }
    if (this.staticPreview() === null) {
      if (this.loading()) {
        return this.transloco.translate('seats.impact.checking');
      }
      if (this.failed()) {
        return this.transloco.translate('seats.impact.failed');
      }
    }
    const data = this.effectivePreview();
    const shortMod = data?.modules.find((mod) => mod.usedAfter > mod.capacity);
    if (shortMod) {
      return this.transloco.translate('seats.impact.blockedReason', {
        module: this.moduleLabel(shortMod),
      });
    }
    return this.transloco.translate('seats.errors.capacityGeneric');
  });

  private requestSeq = 0;

  constructor() {
    effect(() => {
      this.blocking.emit(this.isBlocked());
    });

    effect(() => {
      this.blockingReason.emit(this.currentBlockingReason());
    });

    effect((onCleanup) => {
      const precomputed = this.staticPreview();
      if (precomputed !== null) {
        this.requestSeq++;
        this.loading.set(false);
        this.failed.set(false);
        this.previewData.set(precomputed);
        this.preview.emit(precomputed);
        return;
      }

      const currentChanges = this.changes();
      if (currentChanges === null) {
        this.requestSeq++;
        this.loading.set(false);
        this.failed.set(false);
        this.previewData.set(null);
        this.expandedModules.set(new Set());
        this.preview.emit(null);
        return;
      }

      const seq = ++this.requestSeq;
      this.failed.set(false);
      this.previewData.set(null);
      this.loading.set(true);

      const timer = setTimeout(() => {
        void this.runPreview(seq, currentChanges);
      }, 400);

      onCleanup(() => clearTimeout(timer));
    });
  }

  protected retry(): void {
    const currentChanges = this.changes();
    if (currentChanges === null || this.loading()) return;
    const seq = ++this.requestSeq;
    this.failed.set(false);
    this.previewData.set(null);
    this.loading.set(true);
    void this.runPreview(seq, currentChanges);
  }

  private async runPreview(seq: number, currentChanges: SeatChange[]): Promise<void> {
    try {
      const result = await previewSeats(currentChanges);
      if (seq !== this.requestSeq) return;
      this.previewData.set(result);
      this.loading.set(false);
      this.failed.set(false);
      this.preview.emit(result);
    } catch {
      if (seq !== this.requestSeq) return;
      this.loading.set(false);
      this.failed.set(true);
      this.previewData.set(null);
      this.preview.emit(null);
    }
  }

  protected moduleLabel(mod: SeatPreviewModule): string {
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

  protected deltaOf(mod: SeatPreviewModule): number {
    return mod.usedAfter - mod.used;
  }

  protected formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `\u2212${Math.abs(delta)}`;
    return '0';
  }

  protected userCount(mod: SeatPreviewModule): number {
    return mod.gaining.length + mod.losing.length;
  }

  protected isExpanded(moduleKey: string): boolean {
    return this.expandedModules().has(moduleKey);
  }

  protected toggleModule(moduleKey: string): void {
    this.expandedModules.update((current) => {
      const next = new Set(current);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  }

  protected initials(name: string): string {
    return seatInitials(name);
  }
}
