import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendarEvent, tablerCheck, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { listActivityTargets } from '../../../../../shared/widgets/activities/activities.api';
import {
  ACTIVITY_TARGET_TYPES,
  ActivityTargetOption,
  TargetApp,
} from '../../../../../shared/widgets/activities/activities.model';
import { RecordTarget } from '../../../../../shared/widgets/activities/record-activities/record-activities';

const SKELETON_ROWS = [1, 2, 3, 4] as const;
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-record-picker-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerCalendarEvent, tablerSearch, tablerX, tablerCheck })],
  templateUrl: './record-picker-modal.html',
})
export class RecordPickerModal {
  private static nextId = 0;
  protected readonly uid = `ws-record-picker-${++RecordPickerModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  readonly availableApps = input.required<readonly TargetApp[]>();
  readonly picked = output<RecordTarget>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly selectedApp = signal<TargetApp>('CORE');
  protected readonly selectedType = signal<string>('PARTY');
  protected readonly search = signal('');
  protected readonly results = signal<ActivityTargetOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly selectedTarget = signal<ActivityTargetOption | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;

  protected readonly appOptions = computed<DropdownOption<TargetApp>[]>(() => {
    this.i18n();
    const apps = this.availableApps().length > 0 ? this.availableApps() : (['CORE'] as readonly TargetApp[]);
    return apps.map((app) => ({
      value: app,
      label: this.transloco.translate(`wsActivities.apps.${app}`),
    }));
  });

  protected readonly typeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const app = this.selectedApp();
    const types = ACTIVITY_TARGET_TYPES[app] ?? [];
    return types.map((type) => ({
      value: type,
      label: this.transloco.translate(`wsActivities.recordTypes.${app}.${type}`),
    }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearSearchTimer());
  }

  open(): void {
    const apps = this.availableApps();
    const initialApp: TargetApp = apps[0] ?? 'CORE';
    const initialType = ACTIVITY_TARGET_TYPES[initialApp][0] ?? 'PARTY';
    this.selectedApp.set(initialApp);
    this.selectedType.set(initialType);
    this.search.set('');
    this.selectedTarget.set(null);
    this.results.set([]);
    this.loadFailed.set(false);
    this.modal().open();
    void this.loadTargets();
  }

  close(): void {
    this.clearSearchTimer();
    this.modal().close();
  }

  protected onAppChange(app: TargetApp): void {
    if (app === this.selectedApp()) return;
    this.clearSearchTimer();
    this.selectedApp.set(app);
    this.selectedType.set(ACTIVITY_TARGET_TYPES[app][0] ?? 'PARTY');
    this.selectedTarget.set(null);
    void this.loadTargets();
  }

  protected onTypeChange(type: string): void {
    if (type === this.selectedType()) return;
    this.clearSearchTimer();
    this.selectedType.set(type);
    this.selectedTarget.set(null);
    void this.loadTargets();
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, 100);
    this.search.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadTargets();
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.search.set('');
    void this.loadTargets();
  }

  protected retryLoad(): void {
    void this.loadTargets();
  }

  protected isTargetSelected(option: ActivityTargetOption): boolean {
    const current = this.selectedTarget();
    return (
      current !== null &&
      current.targetApp === option.targetApp &&
      current.targetType === option.targetType &&
      current.targetId === option.targetId
    );
  }

  protected selectTarget(option: ActivityTargetOption): void {
    this.selectedTarget.set(option);
  }

  protected confirmWith(option: ActivityTargetOption): void {
    this.selectedTarget.set(option);
    this.confirm();
  }

  protected confirm(): void {
    const picked = this.selectedTarget();
    if (!picked) return;
    this.close();
    this.picked.emit({
      app: picked.targetApp,
      type: picked.targetType,
      id: picked.targetId,
      label: picked.label,
    });
  }

  protected onClosed(): void {
    this.clearSearchTimer();
    this.loadSeq++;
    this.selectedTarget.set(null);
  }

  private async loadTargets(): Promise<void> {
    const seq = ++this.loadSeq;
    const targetApp = this.selectedApp();
    const targetType = this.selectedType();
    const search = this.search().trim() || undefined;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const list = await listActivityTargets({ targetApp, targetType, search });
      if (seq !== this.loadSeq) return;
      this.results.set(list);
      const current = this.selectedTarget();
      if (
        current &&
        !list.some(
          (item) =>
            item.targetApp === current.targetApp &&
            item.targetType === current.targetType &&
            item.targetId === current.targetId,
        )
      ) {
        this.selectedTarget.set(null);
      }
    } catch {
      if (seq !== this.loadSeq) return;
      this.results.set([]);
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
