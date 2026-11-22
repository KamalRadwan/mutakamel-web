import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../core/i18n/language';
import { ScopeState } from '../../../core/scope/scope';
import { listPipelines } from './opportunities.api';
import type { PipelineView } from './opportunities.model';

const STORAGE_KEY = 'crm.pipeline';

@Injectable({ providedIn: 'root' })
export class PipelineScope {
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly pipelinesState = signal<PipelineView[]>([]);
  private readonly selectedIdState = signal<string | null>(null);
  private readonly loadedState = signal(false);
  private readonly loadFailedState = signal(false);
  private readonly droppedToFallback = signal(false);

  private inFlight: Promise<void> | null = null;
  private inFlightBranchId: string | null = null;
  private lastLoadedBranchId: string | null = null;

  readonly pipelines: Signal<PipelineView[]> = this.pipelinesState.asReadonly();
  readonly loaded: Signal<boolean> = this.loadedState.asReadonly();
  readonly loadFailed: Signal<boolean> = this.loadFailedState.asReadonly();

  readonly current: Signal<PipelineView | null> = computed(() => {
    const list = this.pipelinesState();
    if (list.length === 0) return null;
    const selectedId = this.selectedIdState();
    return list.find((p) => p.id === selectedId) ?? list.find((p) => p.isDefault) ?? list[0] ?? null;
  });

  readonly fallbackNotice: Signal<string | null> = computed(() => {
    this.i18n();
    if (!this.droppedToFallback()) return null;
    const active = this.current();
    if (!active) return null;
    const lang = this.language.current();
    const name = lang === 'ar' ? active.nameAr : active.nameEn;
    const translated = this.transloco.translate('opportunities.pipelineFallback', { name });
    if (translated && translated !== 'opportunities.pipelineFallback') {
      return translated;
    }
    return lang === 'ar'
      ? `المسار الذي استخدمته غير متاح. يُعرض ${name}.`
      : `The pipeline you used is not available. Showing ${name}.`;
  });

  constructor() {
    effect(() => {
      const branchId = this.scope.branch().id;
      untracked(() => {
        if (this.loadedState() && this.lastLoadedBranchId !== null && this.lastLoadedBranchId !== branchId) {
          void this.reload();
        }
      });
    });
  }

  ensureLoaded(): Promise<void> {
    const branchId = this.scope.branch().id;
    if (this.loadedState() && this.lastLoadedBranchId === branchId) {
      return Promise.resolve();
    }
    if (this.inFlight && this.inFlightBranchId === branchId) {
      return this.inFlight;
    }
    return this.reload();
  }

  select(pipelineId: string): void {
    if (!this.pipelinesState().some((p) => p.id === pipelineId)) return;
    this.selectedIdState.set(pipelineId);
    this.droppedToFallback.set(false);
    writeStored(() => sessionStorage, pipelineId);
    writeStored(() => localStorage, pipelineId);
  }

  clearFallbackNotice(): void {
    this.droppedToFallback.set(false);
  }

  reload(): Promise<void> {
    const branchId = this.scope.branch().id;
    const promise = listPipelines()
      .then((list) => {
        this.pipelinesState.set(list);
        this.resolveSelection(list);
        this.lastLoadedBranchId = branchId;
        this.loadFailedState.set(false);
        this.loadedState.set(true);
      })
      .catch(() => {
        this.loadFailedState.set(true);
        this.loadedState.set(true);
      })
      .finally(() => {
        if (this.inFlight === promise) {
          this.inFlight = null;
          this.inFlightBranchId = null;
        }
      });

    this.inFlight = promise;
    this.inFlightBranchId = branchId;
    return promise;
  }

  private resolveSelection(list: PipelineView[]): void {
    const fromTab = readStored(() => sessionStorage);
    const fromGeneral = readStored(() => localStorage);

    const tabMatch = fromTab ? list.find((p) => p.id === fromTab) : undefined;
    if (tabMatch) {
      this.selectedIdState.set(tabMatch.id);
      this.droppedToFallback.set(false);
      return;
    }

    const generalMatch = fromGeneral ? list.find((p) => p.id === fromGeneral) : undefined;
    if (generalMatch) {
      this.selectedIdState.set(generalMatch.id);
      writeStored(() => sessionStorage, generalMatch.id);
      this.droppedToFallback.set(fromTab !== null);
      return;
    }

    const fallback = list.find((p) => p.isDefault) ?? list[0] ?? null;
    this.selectedIdState.set(fallback?.id ?? null);

    if (fallback) {
      writeStored(() => sessionStorage, fallback.id);
      writeStored(() => localStorage, fallback.id);
    } else {
      removeStored(() => sessionStorage);
      removeStored(() => localStorage);
    }

    this.droppedToFallback.set(fromTab !== null || fromGeneral !== null);
  }
}

function readStored(getStorage: () => Storage): string | null {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function writeStored(getStorage: () => Storage, pipelineId: string): void {
  try {
    getStorage().setItem(STORAGE_KEY, pipelineId);
  } catch {
    // Storage unavailable or quota exceeded
  }
}

function removeStored(getStorage: () => Storage): void {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
}
