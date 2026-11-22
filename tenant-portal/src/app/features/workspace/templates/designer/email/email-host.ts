import { Component, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import type { TemplateBinding } from '../../templates.model';
import { DesignerCommand, DesignerState } from '../designer-state';
import { FieldPicker } from '../fields/field-picker/field-picker';
import { EmailSettingsModal } from './email-settings-modal/email-settings-modal';
import { hasNonEmptyTextTemplate } from './email-validation';
import { LinkModal } from './link-modal/link-modal';

@Component({
  selector: 'app-tpl-email-host',
  imports: [EmailSettingsModal, LinkModal, FieldPicker],
  templateUrl: './email-host.html',
})
export class EmailHost {
  protected readonly state = inject(DesignerState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  private readonly settingsModal = viewChild.required<EmailSettingsModal>('settingsModal');
  private readonly linkModal = viewChild.required<LinkModal>('linkModal');
  private readonly picker = viewChild.required<FieldPicker>('picker');

  protected readonly pickerOpen = signal(false);
  private lastHandledSeq = 0;
  private readonly autoOpenedTemplates = new Set<string>();

  protected readonly pickScalarBinding = (initial?: TemplateBinding) =>
    this.openFieldPicker('SCALAR', initial);

  protected readonly pickUrlBinding = (initial?: TemplateBinding) =>
    this.openFieldPicker('URL', initial);

  constructor() {
    effect(() => {
      const entry = this.state.command();
      if (!entry || entry.seq === this.lastHandledSeq) return;
      const { seq, cmd } = entry;
      if (
        cmd.kind !== 'openEmailSettings' &&
        cmd.kind !== 'insertButton' &&
        cmd.kind !== 'insertLink' &&
        cmd.kind !== 'editLink'
      ) {
        return;
      }

      this.lastHandledSeq = seq;
      untracked(() => this.handleCommand(cmd));
    });

    effect(() => {
      const loading = this.state.loading();
      const templateId = this.state.templateId();
      const doc = this.state.document();
      const channel = this.state.channel();
      const readOnly = this.state.readOnly();

      if (loading || !templateId || !doc || channel !== 'EMAIL' || readOnly) {
        return;
      }

      if (this.autoOpenedTemplates.has(templateId)) {
        return;
      }

      if (hasNonEmptyTextTemplate(doc.email?.subject)) {
        return;
      }

      this.autoOpenedTemplates.add(templateId);
      untracked(() => {
        queueMicrotask(() => {
          this.notify.info(this.transloco.translate('tplEmail.toast.addSubject'));
          this.settingsModal().open();
        });
      });
    });
  }

  private handleCommand(cmd: DesignerCommand): void {
    switch (cmd.kind) {
      case 'openEmailSettings':
        if (this.state.channel() === 'EMAIL') {
          this.settingsModal().open();
        }
        break;
      case 'insertButton':
        if (!this.state.readOnly() && this.state.toolState('BUTTON').state === 'ENABLED') {
          this.linkModal().openInsert('button');
        }
        break;
      case 'insertLink':
        if (!this.state.readOnly() && this.state.toolState('LINK').state === 'ENABLED') {
          this.linkModal().openInsert('link');
        }
        break;
      case 'editLink': {
        const node = this.state.document()?.nodes[cmd.nodeId];
        if (node && (node.type === 'link' || node.type === 'button')) {
          this.linkModal().openEdit(node);
        }
        break;
      }
      default:
        break;
    }
  }

  private async openFieldPicker(
    accept: 'SCALAR' | 'URL',
    initial?: TemplateBinding,
  ): Promise<TemplateBinding | null> {
    this.pickerOpen.set(true);
    try {
      const result = await this.picker().open({
        purpose: 'BINDING',
        accept,
        ...(initial ? { initial } : {}),
      });
      if (!result) return null;
      return result.binding ?? { path: result.path, nullBehavior: 'EMPTY' };
    } finally {
      this.pickerOpen.set(false);
    }
  }
}
