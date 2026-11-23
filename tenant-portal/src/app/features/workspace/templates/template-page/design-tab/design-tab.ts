import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFileSearch, tablerLock, tablerRefresh, tablerTemplate } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { TemplateCanvas } from '../../designer/canvas/template-canvas';
import { DesignerState } from '../../designer/designer-state';
import { EmailHost } from '../../designer/email/email-host';
import { FieldsHost } from '../../designer/fields/fields-host';
import { Ribbon } from '../../designer/ribbon/ribbon';
import { SelectionBar } from '../../designer/selection-bar/selection-bar';
import { StatusBar } from '../../designer/status-bar/status-bar';
import { TablesHost } from '../../designer/tables/tables-host';
import { ToolsHost } from '../../designer/tools/tools-host';
import { TemplatePageService } from '../template-page.service';

@Component({
  selector: 'app-design-tab',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Ribbon,
    SelectionBar,
    TemplateCanvas,
    StatusBar,
    ToolsHost,
    FieldsHost,
    TablesHost,
    EmailHost,
  ],
  providers: [
    provideTranslocoScope(
      'templates',
      { scope: 'templates-designer', alias: 'tplDesigner' },
      { scope: 'templates-designer-tools', alias: 'tplTools' },
      { scope: 'templates-designer-fields', alias: 'tplFields' },
      { scope: 'templates-designer-tables', alias: 'tplTables' },
      { scope: 'templates-designer-email', alias: 'tplEmail' },
    ),
    provideIcons({ tablerFileSearch, tablerLock, tablerRefresh, tablerTemplate }),
  ],
  templateUrl: './design-tab.html',
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class DesignTab {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly pageService = inject(TemplatePageService);
  protected readonly state = inject(DesignerState);

  constructor() {
    effect(() => {
      const id =
        this.pageService.definition()?.templateId ??
        this.route.snapshot.paramMap.get('id') ??
        '';
      if (id && id !== this.state.templateId()) {
        void this.state.init(id);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.state.fullscreen()) {
        this.state.fullscreen.set(false);
      }
    });
  }

  protected onEscape(event: Event): void {
    if (!this.state.fullscreen() || event.defaultPrevented) return;
    if (this.doc.querySelector('dialog[open]')) return;
    event.preventDefault();
    this.state.fullscreen.set(false);
  }

  protected retry(): void {
    void this.state.reload();
  }
}
