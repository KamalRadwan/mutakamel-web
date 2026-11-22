import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, model, signal } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerGripVertical,
  tablerLayoutList,
  tablerLayoutRows,
  tablerLock,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Switch } from '../../../../shared/ui/switch/switch';
import { type TabItem, Tabs } from '../../../../shared/ui/tabs/tabs';
import type {
  ProfileComponentConfig,
  ProfileContent,
  ProfileEvidenceConfig,
  ProfileFieldConfig,
} from '../profiles.model';
import type {
  ProfileComponentDef,
  ProfileEvidenceDef,
  ProfileFamilyRegistry,
  ProfileFieldDef,
  ProfileModeDef,
} from '../profiles.registry';

export type ProfileContentTab = 'fields' | 'layout' | 'behaviour' | 'evidence';

interface ResolvedFieldRow {
  def: ProfileFieldDef;
  config: ProfileFieldConfig;
}

interface ResolvedComponentRow {
  def: ProfileComponentDef;
  config: ProfileComponentConfig;
}

interface ResolvedEvidenceRow {
  def: ProfileEvidenceDef;
  config: ProfileEvidenceConfig;
}

@Component({
  selector: 'app-profile-content-editor',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Dropdown,
    Field,
    Switch,
    Tabs,
  ],
  providers: [
    provideIcons({
      tablerLock,
      tablerGripVertical,
      tablerLayoutList,
      tablerLayoutRows,
      tablerAdjustmentsHorizontal,
      tablerShieldCheck,
    }),
  ],
  templateUrl: './profile-content-editor.html',
  host: { class: 'block min-w-0' },
})
export class ProfileContentEditor {
  private static nextId = 0;
  protected readonly uid = `gov-profile-editor-${++ProfileContentEditor.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly content = model.required<ProfileContent>();
  readonly family = input.required<ProfileFamilyRegistry>();
  readonly readonly = input(false);
  readonly tab = input<ProfileContentTab | null>(null);

  protected readonly internalTab = signal<ProfileContentTab>('fields');

  protected readonly activeTab = computed<ProfileContentTab>(() => this.tab() ?? this.internalTab());

  protected readonly fieldsTableTrack =
    'grid-cols-trade-profile-field-row';
  protected readonly evidenceTableTrack = 'grid-cols-trade-profile-evidence-row';
  protected readonly layoutTableTrack = computed(() =>
    this.readonly()
      ? 'grid-cols-trade-profile-layout-row'
      : 'grid-cols-trade-profile-layout-row-actions',
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    const fam = this.family();
    return [
      {
        id: 'fields',
        label: this.transloco.translate('profiles.tabs.fields'),
        icon: 'tablerLayoutList',
        count: fam.fields.length,
      },
      {
        id: 'layout',
        label: this.transloco.translate('profiles.tabs.layout'),
        icon: 'tablerLayoutRows',
        count: fam.components.length,
      },
      {
        id: 'behaviour',
        label: this.transloco.translate('profiles.tabs.behaviour'),
        icon: 'tablerAdjustmentsHorizontal',
      },
      {
        id: 'evidence',
        label: this.transloco.translate('profiles.tabs.evidence'),
        icon: 'tablerShieldCheck',
      },
    ];
  });

  protected readonly fieldRows = computed<ResolvedFieldRow[]>(() => {
    const fam = this.family();
    const byCode = new Map(this.content().fields.map((item) => [item.code, item]));
    return fam.fields.map((def) => {
      const existing = byCode.get(def.code);
      const visible = def.familyRequired ? true : (existing?.visible ?? def.defaultVisible);
      const required = def.familyRequired
        ? true
        : def.serverOwned
          ? false
          : visible && (existing?.required ?? def.defaultRequired);
      return {
        def,
        config: { code: def.code, visible, required },
      };
    });
  });

  protected readonly componentRows = computed<ResolvedComponentRow[]>(() => {
    const fam = this.family();
    const byCode = new Map(this.content().components.map((item) => [item.code, item]));
    return fam.components
      .map((def) => {
        const existing = byCode.get(def.code);
        return {
          def,
          config: {
            code: def.code,
            order: existing?.order ?? def.defaultOrder,
            visible: def.mandatory ? true : (existing?.visible ?? def.defaultVisible),
          },
        };
      })
      .sort((a, b) => a.config.order - b.config.order || a.def.defaultOrder - b.def.defaultOrder);
  });

  protected readonly evidenceRows = computed<ResolvedEvidenceRow[]>(() => {
    const fam = this.family();
    const byCode = new Map(this.content().evidence.map((item) => [item.code, item]));
    return fam.evidence.map((def) => {
      const existing = byCode.get(def.code);
      const include = existing?.include ?? (existing ? true : def.defaultInclude);
      const required = include ? (existing?.required ?? def.defaultRequired) : false;
      return {
        def,
        config: { code: def.code, include, required },
      };
    });
  });

  protected onInternalTabChange(next: string): void {
    if (next === 'fields' || next === 'layout' || next === 'behaviour' || next === 'evidence') {
      this.internalTab.set(next);
    }
  }

  protected fieldVisibleAria(code: string): string {
    this.i18n();
    const fieldLabel = this.transloco.translate(`profiles.registry.fields.${code}`);
    return this.transloco.translate('profiles.fields.visibleAria', { field: fieldLabel });
  }

  protected fieldRequiredAria(code: string): string {
    this.i18n();
    const fieldLabel = this.transloco.translate(`profiles.registry.fields.${code}`);
    return this.transloco.translate('profiles.fields.requiredAria', { field: fieldLabel });
  }

  protected componentVisibleAria(code: string): string {
    this.i18n();
    const label = this.transloco.translate(`profiles.registry.components.${code}`);
    return this.transloco.translate('profiles.layout.visibleAria', { component: label });
  }

  protected evidenceIncludeAria(code: string): string {
    this.i18n();
    const label = this.transloco.translate(`profiles.registry.evidence.${code}`);
    return this.transloco.translate('profiles.evidence.includeAria', { evidence: label });
  }

  protected evidenceRequiredAria(code: string): string {
    this.i18n();
    const label = this.transloco.translate(`profiles.registry.evidence.${code}`);
    return this.transloco.translate('profiles.evidence.requiredAria', { evidence: label });
  }

  protected setFieldVisible(def: ProfileFieldDef, nextVisible: boolean): void {
    if (this.readonly() || def.familyRequired) return;
    const rows = this.fieldRows().map((r) => {
      if (r.def.code !== def.code) return r.config;
      return {
        code: def.code,
        visible: nextVisible,
        required: nextVisible ? r.config.required : false,
      };
    });
    this.content.update((c) => ({ ...c, fields: rows }));
  }

  protected setFieldRequired(def: ProfileFieldDef, nextRequired: boolean): void {
    if (this.readonly() || def.familyRequired || def.serverOwned) return;
    const rows = this.fieldRows().map((r) => {
      if (r.def.code !== def.code) return r.config;
      return {
        code: def.code,
        visible: nextRequired ? true : r.config.visible,
        required: nextRequired,
      };
    });
    this.content.update((c) => ({ ...c, fields: rows }));
  }

  protected setComponentVisible(def: ProfileComponentDef, nextVisible: boolean): void {
    if (this.readonly() || def.mandatory) return;
    const updated = this.componentRows().map((r) =>
      r.def.code === def.code ? { ...r.config, visible: nextVisible } : r.config,
    );
    this.content.update((c) => ({ ...c, components: updated }));
  }

  protected componentRowActions(index: number, total: number): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'moveUp',
        title: this.transloco.translate('profiles.layout.actions.moveUp'),
        icon: 'tablerArrowBackUp',
        tile: index === 0 ? 'bg-icon-gray' : 'bg-icon-teal',
        disabled: index === 0,
      },
      {
        id: 'moveDown',
        title: this.transloco.translate('profiles.layout.actions.moveDown'),
        icon: 'tablerArrowRight',
        tile: index >= total - 1 ? 'bg-icon-gray' : 'bg-icon-teal',
        disabled: index >= total - 1,
      },
    ];
  }

  protected onComponentAction(index: number, selection: ActionSelection): void {
    if (this.readonly()) return;
    const rows = this.componentRows().map((r) => ({ ...r.config }));
    const targetIndex = selection.id === 'moveUp' ? index - 1 : selection.id === 'moveDown' ? index + 1 : -1;
    if (targetIndex < 0 || targetIndex >= rows.length || targetIndex === index) return;
    moveItemInArray(rows, index, targetIndex);
    this.commitComponentOrder(rows);
  }

  protected onComponentDrop(event: CdkDragDrop<ResolvedComponentRow[]>): void {
    if (this.readonly() || event.previousIndex === event.currentIndex) return;
    const rows = this.componentRows().map((r) => ({ ...r.config }));
    moveItemInArray(rows, event.previousIndex, event.currentIndex);
    this.commitComponentOrder(rows);
  }

  protected modeOptions(mode: ProfileModeDef): DropdownOption<string>[] {
    this.i18n();
    return mode.allowedValues.map((val) => ({
      value: val,
      label: this.transloco.translate(`profiles.registry.modes.${mode.key}.values.${val}`),
    }));
  }

  protected modeValueAsString(mode: ProfileModeDef): string {
    const raw = this.content().modes?.[mode.key] ?? mode.defaultValue;
    return typeof raw === 'boolean' ? String(raw) : String(raw);
  }

  protected modeNote(mode: ProfileModeDef): string | null {
    this.i18n();
    const key = `profiles.registry.modes.${mode.key}.note`;
    const text = this.transloco.translate(key);
    return text && text !== key ? text : null;
  }

  protected onModeChange(mode: ProfileModeDef, rawValue: string): void {
    if (this.readonly() || mode.locked) return;
    const parsed: string | boolean = mode.kind === 'boolean' ? rawValue === 'true' : rawValue;
    this.content.update((c) => ({
      ...c,
      modes: {
        ...c.modes,
        [mode.key]: parsed,
      },
    }));
  }

  protected setEvidenceInclude(def: ProfileEvidenceDef, nextInclude: boolean): void {
    if (this.readonly()) return;
    const rows = this.evidenceRows().map((r) => {
      if (r.def.code !== def.code) return r.config;
      return {
        code: def.code,
        include: nextInclude,
        required: nextInclude ? r.config.required : false,
      };
    });
    this.content.update((c) => ({ ...c, evidence: rows }));
  }

  protected setEvidenceRequired(def: ProfileEvidenceDef, nextRequired: boolean): void {
    if (this.readonly()) return;
    const rows = this.evidenceRows().map((r) => {
      if (r.def.code !== def.code) return r.config;
      return {
        code: def.code,
        include: nextRequired ? true : r.config.include,
        required: nextRequired,
      };
    });
    this.content.update((c) => ({ ...c, evidence: rows }));
  }

  private commitComponentOrder(rows: ProfileComponentConfig[]): void {
    const renumbered = rows.map((item, idx) => ({
      ...item,
      order: (idx + 1) * 10,
    }));
    this.content.update((c) => ({ ...c, components: renumbered }));
  }
}
