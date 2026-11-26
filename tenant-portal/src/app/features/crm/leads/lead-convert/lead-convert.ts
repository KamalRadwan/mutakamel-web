import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { crmSettingsError } from '../../settings/shared/settings-api';
import { convertLead } from '../leads.api';
import { leadActionRow } from '../lead-page/lead-record-access';
import { LeadDetail, LeadsCapabilities, leadActionAllowed } from '../leads.model';

@Component({
  selector: 'app-lead-convert',
  imports: [Button, ConfirmDialog, TranslocoPipe],
  templateUrl: './lead-convert.html',
})
export class LeadConvert {
  private readonly dialog = viewChild.required(ConfirmDialog);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  readonly lead = input.required<LeadDetail>();
  readonly capabilities = input<LeadsCapabilities | null>(null);
  readonly blocked = input(false);
  readonly converted = output<LeadDetail>();

  protected readonly busy = signal(false);
  protected readonly canConvert = computed(() => {
    const lead = this.lead();
    const capabilities = this.capabilities();
    const scope = capabilities?.leads.convert;
    return lead.status !== 'CONVERTED' && lead.status !== 'DISQUALIFIED' && lead.stageFlag !== 'DISQUALIFIED' &&
      capabilities?.branchId === lead.branchId && leadActionAllowed(scope, leadActionRow(lead));
  });

  protected async confirm(): Promise<void> {
    if (!this.canConvert() || this.blocked() || this.busy()) return;
    const lead = this.lead();
    this.busy.set(true);
    try {
      if (!await this.dialog().open() || lead.id !== this.lead().id || this.blocked() || !this.canConvert()) return;
      const converted = await convertLead(lead.id, lead.leadProfileType);
      this.notify.success(this.transloco.translate('leadForm.convert.done'));
      this.converted.emit(converted);
    } catch (error) {
      this.notify.error(crmSettingsError(this.transloco, error, 'leadForm').message);
    } finally {
      this.busy.set(false);
    }
  }
}
