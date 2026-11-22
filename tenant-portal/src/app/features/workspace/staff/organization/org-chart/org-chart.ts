import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerEdit,
  tablerEye,
  tablerLock,
  tablerPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { ORG_LEVEL_META, OrgActionEvent, OrgLevel, OrgLevelMeta, OrgViewNode } from '../organization.model';

@Component({
  selector: 'app-org-chart',
  imports: [NgTemplateOutlet, NgIcon, TranslocoPipe, ActionsMenu],
  providers: [
    provideIcons({
      tablerUsers,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerLock,
    }),
  ],
  templateUrl: './org-chart.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class OrgChart {
  readonly tree = input.required<OrgViewNode[]>();
  readonly actionsFor = input.required<(node: OrgViewNode) => ActionItem[]>();
  readonly action = output<OrgActionEvent>();

  protected readonly selectedId = signal<string | null>(null);

  protected meta(level: OrgLevel): OrgLevelMeta {
    return ORG_LEVEL_META[level];
  }

  protected selectCard(node: OrgViewNode): void {
    this.selectedId.set(node.id);
  }

  protected onActionSelected(node: OrgViewNode, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.action.emit({ node, action: 'open' });
        break;
      case 'edit':
        this.action.emit({ node, action: 'edit' });
        break;
      case 'addChild':
        this.action.emit({ node, action: 'addChild' });
        break;
      case 'viewUsers':
        this.action.emit({ node, action: 'viewUsers' });
        break;
    }
  }
}
