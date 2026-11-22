import { Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerLayoutDashboard } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { type ScopeCompany, ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, type TradeContext, errorCodeOf, errorKey, newIdempotencyKey } from '../../shared/trade-api';
import { createDashboard, createFromTemplate, updateDashboard } from '../trade-dashboard.api';
import type { Catalog, CreateDashboardBody, DashboardDetail, TemplateKey } from '../trade-dashboard.model';

type ModalMode = 'create' | 'edit';
type CreateTab = 'blank' | 'template';
type BlankScopeMode = 'SINGLE' | 'MULTI';

interface TemplateTile {
  key: TemplateKey;
  label: string;
  description: string;
  widgetsLine: string;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;
const INVALID_NAME_CHARS = /[<>]/;

let nextCreateModalSeq = 0;

@Component({
  selector: 'app-trade-dashboard-create-modal',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field, Modal, Segmented, UnsavedDialog],
  providers: [provideIcons({ tablerLayoutDashboard, tablerCheck })],
  // Takes inputs, so the component-level scope lives in viewProviders (tenant-portal Transloco rule).
  viewProviders: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-dashboard', alias: 'tradeDashboard' },
      { scope: 'trade-dashboard-modals', alias: 'tradeDashboardModals' },
    ),
  ],
  templateUrl: './dashboard-create-modal.html',
  host: { class: 'contents' },
})
export class DashboardCreateModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modalScope = toSignal(this.transloco.selectTranslation('trade-dashboard-modals'));
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly templateButtons = viewChildren<ElementRef<HTMLButtonElement>>('templateBtn');

  protected readonly uid = `trade-dash-create-${++nextCreateModalSeq}`;
  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  readonly ctx = input.required<TradeContext>();
  readonly catalog = input<Catalog | null>(null);
  readonly created = output<{ dashboard: DashboardDetail; existed: boolean }>();
  readonly updated = output<DashboardDetail>();

  private idempotencyKey = '';
  private confirmingUnsaved = false;

  protected readonly modalMode = signal<ModalMode>('create');
  protected readonly createTab = signal<CreateTab>('blank');
  protected readonly editingDetail = signal<DashboardDetail | null>(null);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly scopeMode = signal<BlankScopeMode>('SINGLE');
  protected readonly selectedCompanyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly chosenTemplateKey = signal<TemplateKey | null>(null);
  private readonly initialTemplateKey = signal<TemplateKey | null>(null);

  protected readonly submitting = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);
  protected readonly companiesError = signal<string | null>(null);
  protected readonly templateError = signal<string | null>(null);

  protected readonly companies = this.scope.companies;

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.modalScope();
    return this.transloco.translate(
      this.modalMode() === 'edit' ? 'tradeDashboardModals.create.editTitle' : 'tradeDashboardModals.create.createTitle',
    );
  });

  protected readonly createTabOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.modalScope();
    return [
      { value: 'blank', label: this.transloco.translate('tradeDashboardModals.create.blank') },
      { value: 'template', label: this.transloco.translate('tradeDashboardModals.create.fromTemplate') },
    ];
  });

  protected readonly companyModeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.modalScope();
    return [
      { value: 'SINGLE', label: this.transloco.translate('tradeDashboardModals.create.thisCompany') },
      { value: 'MULTI', label: this.transloco.translate('tradeDashboardModals.create.severalCompanies') },
    ];
  });

  protected readonly templateTiles = computed<TemplateTile[]>(() => {
    this.i18n();
    this.modalScope();
    const list = this.catalog()?.templates ?? [];
    return list.map((tpl) => ({
      key: tpl.key,
      label: this.transloco.translate(`tradeDashboardModals.templates.${tpl.key}.label`),
      description: this.transloco.translate(`tradeDashboardModals.templates.${tpl.key}.description`),
      widgetsLine: tpl.widgetDefinitionCodes
        .map((code) => this.transloco.translate(`tradeDashboardModals.widgetCode.${code}`))
        .join(' · '),
    }));
  });

  protected readonly selectedTemplateKey = computed<TemplateKey | null>(() => {
    const tiles = this.templateTiles();
    if (tiles.length === 0) return null;
    const chosen = this.chosenTemplateKey();
    if (chosen && tiles.some((t) => t.key === chosen)) return chosen;
    return tiles[0].key;
  });

  protected readonly selectedTemplateLabel = computed(() => {
    const key = this.selectedTemplateKey();
    if (!key) return '';
    return this.templateTiles().find((t) => t.key === key)?.label ?? '';
  });

  protected readonly templateDescribedBy = computed(() => {
    const base = `${this.uid}-template-hint`;
    return this.templateError() ? `${base} ${this.uid}-template-error` : base;
  });

  protected readonly isDirty = computed(() => {
    if (this.modalMode() === 'edit') {
      const detail = this.editingDetail();
      if (!detail) return false;
      return this.name() !== detail.name || this.description() !== (detail.description ?? '');
    }
    if (this.createTab() === 'blank') {
      return this.name().trim().length > 0 || this.description().trim().length > 0 || this.scopeMode() !== 'SINGLE';
    }
    const currentTpl = this.chosenTemplateKey();
    const initialTpl = this.initialTemplateKey();
    return this.name().trim().length > 0 || (currentTpl !== null && initialTpl !== null && currentTpl !== initialTpl);
  });

  openCreate(mode: 'blank' | 'template'): void {
    this.modalMode.set('create');
    this.createTab.set(mode);
    this.editingDetail.set(null);
    this.idempotencyKey = newIdempotencyKey();

    this.name.set('');
    this.description.set('');
    this.scopeMode.set('SINGLE');
    const activeCompanyId = this.ctx().companyId ?? this.scope.company()?.id ?? '';
    this.selectedCompanyIds.set(activeCompanyId ? new Set([activeCompanyId]) : new Set());

    const firstTemplate = this.catalog()?.templates[0]?.key ?? null;
    this.chosenTemplateKey.set(firstTemplate);
    this.initialTemplateKey.set(firstTemplate);

    this.clearErrors();
    this.submitting.set(false);
    this.modal().open();
  }

  openEdit(detail: DashboardDetail): void {
    this.modalMode.set('edit');
    this.editingDetail.set(detail);
    this.idempotencyKey = '';
    this.name.set(detail.name);
    this.description.set(detail.description ?? '');
    this.clearErrors();
    this.submitting.set(false);
    this.modal().open();
  }

  protected companyName(company: ScopeCompany): string {
    return this.language() === 'ar' ? company.nameAr : company.nameEn;
  }

  protected onCreateTabChange(next: string | null): void {
    if (next !== 'blank' && next !== 'template') return;
    if (next === this.createTab()) return;
    this.createTab.set(next);
    this.clearErrors();
  }

  protected onNameInput(value: string): void {
    this.name.set(value);
    this.nameError.set(null);
  }

  protected onDescriptionInput(value: string): void {
    this.description.set(value);
    this.descriptionError.set(null);
  }

  protected onScopeModeChange(next: string | null): void {
    if (next !== 'SINGLE' && next !== 'MULTI') return;
    this.scopeMode.set(next);
    this.companiesError.set(null);
  }

  protected toggleCompany(companyId: string, checked: boolean): void {
    this.selectedCompanyIds.update((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(companyId);
      } else {
        next.delete(companyId);
      }
      return next;
    });
    this.companiesError.set(null);
  }

  protected selectTemplate(key: TemplateKey): void {
    this.chosenTemplateKey.set(key);
    this.templateError.set(null);
  }

  protected onTemplateKeydown(event: KeyboardEvent, index: number): void {
    const tiles = this.templateTiles();
    if (tiles.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % tiles.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + tiles.length) % tiles.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = tiles.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const tile = tiles[index];
      if (tile) this.selectTemplate(tile.key);
      return;
    } else {
      return;
    }

    event.preventDefault();
    const nextTile = tiles[targetIndex];
    if (!nextTile) return;
    this.selectTemplate(nextTile.key);
    this.templateButtons()[targetIndex]?.nativeElement.focus();
  }

  protected undoEdit(): void {
    const detail = this.editingDetail();
    if (!detail || this.submitting()) return;
    this.name.set(detail.name);
    this.description.set(detail.description ?? '');
    this.clearErrors();
  }

  protected requestClose(): void {
    if (this.submitting()) return;
    if (!this.isDirty()) {
      this.modal().close();
      return;
    }
    void this.onAttemptDismiss();
  }

  protected async onAttemptDismiss(): Promise<void> {
    if (this.submitting() || this.confirmingUnsaved) return;
    if (!this.isDirty()) {
      this.modal().close();
      return;
    }
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'save') {
        await this.submit();
      } else if (choice === 'discard') {
        this.modal().close();
      }
    } finally {
      this.confirmingUnsaved = false;
    }
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    this.clearErrors();
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.modalMode() === 'edit' && !this.isDirty()) return;
    if (!this.validate()) return;

    this.submitting.set(true);
    try {
      if (this.modalMode() === 'edit') {
        const detail = this.editingDetail();
        if (!detail) return;
        const saved = await updateDashboard(this.ctx(), detail.id, detail.revision, {
          name: this.name().trim(),
          description: this.description().trim(),
        });
        this.updated.emit(saved);
        this.modal().close();
        return;
      }

      if (this.createTab() === 'blank') {
        const trimmedDesc = this.description().trim();
        const isMulti = this.scopeMode() === 'MULTI';
        const chosen = this.selectedCompanyIds();
        const currentCompanyId = this.ctx().companyId ?? this.scope.company().id;
        const body: CreateDashboardBody = {
          name: this.name().trim(),
          ...(trimmedDesc ? { description: trimmedDesc } : {}),
          scopeCoverage: isMulti ? 'MULTI_COMPANY_AUTHORIZED_UNION' : 'SINGLE_COMPANY',
          scopeTargets: isMulti
            ? this.companies()
                .filter((c) => chosen.has(c.id))
                .map((c) => ({ companyId: c.id }))
            : [{ companyId: currentCompanyId }],
        };
        const res = await createDashboard(this.ctx(), body, this.idempotencyKey);
        this.created.emit({ dashboard: res.dashboard, existed: false });
        this.modal().close();
        return;
      }

      const tplKey = this.selectedTemplateKey();
      if (!tplKey) return;
      const trimmedName = this.name().trim();
      const res = await createFromTemplate(
        this.ctx(),
        tplKey,
        trimmedName ? { name: trimmedName } : {},
        this.idempotencyKey,
        this.language(),
      );
      if (!res.created) {
        this.notify.info(this.transloco.translate('tradeDashboardModals.toast.existed'));
      }
      this.created.emit({ dashboard: res.dashboard, existed: !res.created });
      this.modal().close();
    } catch (error) {
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private validate(): boolean {
    this.clearErrors();
    let valid = true;

    const trimmedName = this.name().trim();
    const isTemplate = this.modalMode() === 'create' && this.createTab() === 'template';

    if (!isTemplate && !trimmedName) {
      this.nameError.set(this.transloco.translate('tradeShared.common.required'));
      valid = false;
    } else if (trimmedName.length > NAME_MAX) {
      this.nameError.set(this.transloco.translate('tradeDashboardModals.create.nameTooLong'));
      valid = false;
    } else if (INVALID_NAME_CHARS.test(trimmedName)) {
      this.nameError.set(this.transloco.translate('tradeDashboardModals.create.nameInvalidChars'));
      valid = false;
    }

    if (this.modalMode() === 'edit' || this.createTab() === 'blank') {
      if (this.description().trim().length > DESCRIPTION_MAX) {
        this.descriptionError.set(this.transloco.translate('tradeDashboardModals.create.descriptionTooLong'));
        valid = false;
      }
    }

    if (this.modalMode() === 'create' && this.createTab() === 'blank' && this.scopeMode() === 'MULTI') {
      const validIds = new Set(this.companies().map((c) => c.id));
      const count = Array.from(this.selectedCompanyIds()).filter((id) => validIds.has(id)).length;
      if (count < 2) {
        this.companiesError.set(this.transloco.translate('tradeDashboardModals.create.companiesMin'));
        valid = false;
      }
    }

    if (isTemplate && !this.selectedTemplateKey()) {
      this.templateError.set(this.transloco.translate('tradeDashboardModals.create.templateRequired'));
      valid = false;
    }

    return valid;
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'TRADE.DASHBOARD.NAME_CONFLICT') {
      this.nameError.set(this.transloco.translate('tradeDashboardModals.create.nameConflict'));
      return;
    }
    const pickingCompanies =
      this.modalMode() === 'create' && this.createTab() === 'blank' && this.scopeMode() === 'MULTI';
    // validateScopeTargets (dashboard-catalog.ts:824): fewer than two companies is FILTER_INVALID.
    if (pickingCompanies && (code === 'TRADE.DASHBOARD.FILTER_INVALID' || code === 'TRADE.DASHBOARD.SCOPE_INVALID')) {
      this.companiesError.set(this.transloco.translate('tradeDashboardModals.create.companiesMin'));
      return;
    }
    if (pickingCompanies && code === 'TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH') {
      this.companiesError.set(this.transloco.translate('tradeDashboardModals.create.companiesInvalid'));
      return;
    }
    // details are class-validator messages keyed by property path, so show our own field text.
    if (error instanceof ApiError && code === 'TRADE.VALIDATION_FAILED' && error.details) {
      const paths = Object.keys(error.details);
      const has = (field: string) => paths.some((path) => path === field || path.startsWith(`${field}.`));
      let applied = false;
      if (has('name')) {
        this.nameError.set(this.transloco.translate('tradeDashboardModals.create.nameInvalid'));
        applied = true;
      }
      if (has('description')) {
        this.descriptionError.set(this.transloco.translate('tradeDashboardModals.create.descriptionInvalid'));
        applied = true;
      }
      if (has('scopeTargets') && pickingCompanies) {
        this.companiesError.set(this.transloco.translate('tradeDashboardModals.create.companiesMin'));
        applied = true;
      }
      if (applied) return;
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private clearErrors(): void {
    this.nameError.set(null);
    this.descriptionError.set(null);
    this.companiesError.set(null);
    this.templateError.set(null);
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
