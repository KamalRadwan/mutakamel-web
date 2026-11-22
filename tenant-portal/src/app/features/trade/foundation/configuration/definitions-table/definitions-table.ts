import { Component, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAdjustmentsHorizontal } from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { type ConfigDefinition, RISK_BADGE_CLASS, type ScopeTarget } from '../configuration.model';
import { type SchemaTypeKey, schemaTypeKey } from '../value-schema';
import { VERSION_STATE_BADGE } from '../version-state';

const TABLE_COLUMNS = ['key', 'valueType', 'mergeRule', 'risk', 'allowedScopes', 'versionsHere'] as const;

@Component({
  selector: 'app-config-definitions-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  providers: [provideIcons({ tablerAdjustmentsHorizontal })],
  templateUrl: './definitions-table.html',
  host: { class: 'flex flex-col gap-8' },
})
export class DefinitionsTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly items = input.required<ConfigDefinition[]>();
  readonly loading = input(false);
  readonly scopeTarget = input.required<ScopeTarget>();
  readonly canManage = input(true);

  readonly openDefinition = output<ConfigDefinition>();
  readonly createVersion = output<ConfigDefinition>();

  protected readonly columns = TABLE_COLUMNS;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly riskBadgeClass = RISK_BADGE_CLASS;
  protected readonly liveBadgeClass = VERSION_STATE_BADGE.LIVE;

  protected typeKey(def: ConfigDefinition): SchemaTypeKey {
    return schemaTypeKey(def.valueSchema);
  }

  protected isAllowedHere(def: ConfigDefinition): boolean {
    return def.allowedScopes.includes(this.scopeTarget());
  }

  protected hasLiveVersion(def: ConfigDefinition): boolean {
    return def.versions.some((ver) => ver.effectiveState === 'LIVE');
  }

  protected actionsFor(def: ConfigDefinition): ActionItem[] {
    this.i18n();
    const allowedHere = this.isAllowedHere(def);
    return [
      {
        id: 'open',
        title: this.transloco.translate('tradeShared.common.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'newVersion',
        title: this.transloco.translate('tradeConfig.table.newVersion'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
        disabled: !allowedHere,
        reason: allowedHere ? undefined : this.transloco.translate('tradeConfig.table.notAllowedReason'),
      },
    ];
  }

  protected onAction(def: ConfigDefinition, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openDefinition.emit(def);
    } else if (selection.id === 'newVersion' && this.isAllowedHere(def)) {
      this.createVersion.emit(def);
    }
  }

  protected onRowKeydown(event: KeyboardEvent, def: ConfigDefinition): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openDefinition.emit(def);
    }
  }
}
