import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowDown, tablerArrowUp, tablerCopy, tablerFiles, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type { TemplatePageConfig } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import {
  MAX_CANVAS_PAGES,
  addCanvasPage,
  countPageObjects,
  deleteCanvasPage,
  duplicateCanvasPage,
  effectivePages,
  ensureCanvasPages,
  moveCanvasPage,
  renameCanvasPage,
} from '../page-ops';

@Component({
  selector: 'app-tpl-pages-modal',
  imports: [FormField, NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerArrowDown, tablerArrowUp, tablerCopy, tablerFiles, tablerPlus, tablerTrash })],
  templateUrl: './pages-modal.html',
  host: { class: 'contents' },
})
export class PagesModal {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('pagesModal');
  private readonly confirmDelete = viewChild.required<ConfirmDialog>('confirmDelete');

  protected readonly deleteCount = signal(0);

  open(): void {
    if (this.state.layoutMode() !== 'FIXED_CANVAS' || !this.state.document()) return;
    this.namesModel.set({ names: this.pages().map((p) => p.name) });
    this.modal().open();
  }

  protected readonly pages = computed(() => {
    this.language();
    this.i18n();
    const doc = this.state.document();
    if (!doc) return [];
    return effectivePages(doc, this.defaultPageName(1));
  });

  protected readonly namesModel = linkedSignal<{ names: string[] }>(() => ({
    names: this.pages().map((p) => p.name),
  }));

  protected readonly pagesForm = form(this.namesModel, (p) => {
    readonly(p, () => this.state.readOnly());
  });

  protected readonly atMaxPages = computed(() => this.pages().length >= MAX_CANVAS_PAGES);

  protected readonly deleteDialogText = computed(() => {
    this.language();
    this.i18n();
    return this.transloco.translate('tplFields.pages.deleteText', { n: this.deleteCount() });
  });

  protected paperSummary(page: TemplatePageConfig): string {
    const presetLabel =
      page.preset === 'CUSTOM'
        ? this.transloco.translate('tplFields.pages.presets.CUSTOM', { w: page.widthMm, h: page.heightMm })
        : this.transloco.translate(`tplFields.pages.presets.${page.preset}`);
    const orientLabel = this.transloco.translate(`tplFields.pages.orientations.${page.orientation}`);
    return this.transloco.translate('tplFields.pages.paperSummary', {
      preset: presetLabel,
      orientation: orientLabel,
    });
  }

  protected pageNameLength(index: number): number {
    return (this.namesModel().names[index] ?? '').replace(/[\r\n]+/g, ' ').trim().length;
  }

  protected pageNameError(index: number): string | null {
    this.language();
    this.i18n();
    const raw = this.namesModel().names[index] ?? '';
    const clean = raw.replace(/[\r\n]+/g, ' ').trim();
    if (!clean) return this.transloco.translate('tplFields.pages.nameRequired');
    if (clean.length > 100) return this.transloco.translate('tplFields.pages.nameTooLong');
    return null;
  }

  protected selectPage(index: number): void {
    this.state.pageIndex.set(index);
  }

  protected commitRename(index: number): void {
    if (this.state.readOnly()) return;
    const raw = this.namesModel().names[index] ?? '';
    const clean = raw.replace(/[\r\n]+/g, ' ').trim();
    const current = this.pages()[index]?.name ?? this.defaultPageName(index + 1);
    if (!clean || clean.length > 100) {
      return;
    }
    if (clean === current) {
      if (raw !== current) {
        this.namesModel.update((m) => ({
          names: m.names.map((v, i) => (i === index ? current : v)),
        }));
      }
      return;
    }
    const page1Name = this.defaultPageName(1);
    this.state.apply('renamePage', (doc) => {
      renameCanvasPage(doc, index, clean, page1Name);
    });
  }

  protected addPage(): void {
    if (this.state.readOnly() || this.atMaxPages()) return;
    const nextNum = this.pages().length + 1;
    const page1Name = this.defaultPageName(1);
    const newName = this.defaultPageName(nextNum);
    const currentIdx = this.state.pageIndex();
    let createdIdx = -1;

    this.state.apply('addPage', (doc) => {
      createdIdx = addCanvasPage(doc, currentIdx, newName, page1Name);
    });
    if (createdIdx >= 0) {
      this.state.pageIndex.set(createdIdx);
    }
  }

  protected movePage(event: Event, index: number, delta: -1 | 1): void {
    event.stopPropagation();
    if (this.state.readOnly()) return;
    const page1Name = this.defaultPageName(1);
    let nextIdx = index;
    this.state.apply('movePage', (doc) => {
      ensureCanvasPages(doc, page1Name);
      nextIdx = moveCanvasPage(doc, index, delta);
    });
    this.state.pageIndex.set(nextIdx);
  }

  protected duplicatePage(event: Event, index: number): void {
    event.stopPropagation();
    if (this.state.readOnly() || this.atMaxPages()) return;
    const sourceName = this.pages()[index]?.name ?? this.defaultPageName(index + 1);
    const copyName = this.transloco.translate('tplFields.pages.copyName', { name: sourceName }).slice(0, 100);
    const page1Name = this.defaultPageName(1);
    let createdIdx = -1;

    this.state.apply('duplicatePage', (doc) => {
      createdIdx = duplicateCanvasPage(doc, index, copyName, page1Name);
    });
    if (createdIdx >= 0) {
      this.state.pageIndex.set(createdIdx);
    }
  }

  protected async deletePage(event: Event, index: number): Promise<void> {
    event.stopPropagation();
    const doc = this.state.document();
    if (this.state.readOnly() || !doc || this.pages().length <= 1) return;

    const page1Name = this.defaultPageName(1);
    this.deleteCount.set(countPageObjects(doc, index, page1Name));

    const confirmed = await this.confirmDelete().open();
    if (!confirmed) return;

    let nextIdx = 0;
    this.state.apply('deletePage', (draftDoc) => {
      ensureCanvasPages(draftDoc, page1Name);
      nextIdx = deleteCanvasPage(draftDoc, index);
    });
    this.state.pageIndex.set(nextIdx);
  }

  protected close(): void {
    this.modal().close();
  }

  private defaultPageName(n: number): string {
    return this.transloco.translate('tplFields.pages.pageNumber', { n });
  }
}
