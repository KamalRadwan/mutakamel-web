import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsSplit,
  tablerBolt,
  tablerFolders,
  tablerList,
  tablerLock,
  tablerPaperclip,
  tablerSearch,
  tablerShieldLock,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { StaticDataGroup } from '../static-data.groups';
import { labelIn } from '../static-data.model';

let nextModalId = 0;

@Component({
  selector: 'app-group-details-modal',
  imports: [TranslocoPipe, NgIcon, Modal, Field, Button],
  providers: [
    provideIcons({
      tablerList,
      tablerShieldLock,
      tablerFolders,
      tablerBolt,
      tablerPaperclip,
      tablerArrowsSplit,
      tablerLock,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './group-details-modal.html',
})
export class GroupDetailsModal {
  protected readonly uid = `static-data-details-${++nextModalId}`;
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);

  protected readonly group = signal<StaticDataGroup | null>(null);
  protected readonly entrySearch = signal('');

  protected readonly showEntrySearch = computed(() => {
    const current = this.group();
    return Boolean(current && current.detailVariant === 'options' && current.options.length > 20);
  });

  protected readonly filteredOptions = computed(() => {
    const current = this.group();
    if (!current || current.detailVariant !== 'options') return [];
    const lang = this.language();
    const term = this.entrySearch().trim().toLocaleLowerCase(lang);
    if (!term) return current.options;
    return current.options.filter(
      (opt) =>
        opt.label.ar.toLocaleLowerCase(lang).includes(term) ||
        opt.label.en.toLocaleLowerCase(lang).includes(term) ||
        opt.value.toLocaleLowerCase(lang).includes(term),
    );
  });

  open(group: StaticDataGroup): void {
    this.group.set(group);
    this.entrySearch.set('');
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.entrySearch.set('');
  }

  protected onSearchInput(event: Event): void {
    this.entrySearch.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.entrySearch.set('');
  }

  protected copiedLabel(group: StaticDataGroup): string {
    const opt = group.copiedOwnerOption;
    if (!opt) return '';
    return labelIn(opt.label, this.language());
  }

  protected stageStatusBadgeClass(status: 'WON' | 'LOST' | 'ON_HOLD' | 'IN_PROGRESS'): string {
    switch (status) {
      case 'WON':
        return 'bg-success-soft text-on-success-soft';
      case 'LOST':
        return 'bg-danger-soft text-on-danger-soft';
      case 'ON_HOLD':
        return 'bg-neutral-soft text-warning-text';
      default:
        return 'bg-neutral-soft text-text';
    }
  }

  protected labelText(label: { en: string; ar: string }): string {
    return labelIn(label, this.language());
  }
}
