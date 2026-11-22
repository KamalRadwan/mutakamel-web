import { Service, Signal, signal } from '@angular/core';
import { getCrmClickToCallSetting } from './crm-call-settings.api';

@Service()
export class CrmCallSettings {
  private readonly enabled = signal(true);
  readonly clickToCallEnabled: Signal<boolean> = this.enabled.asReadonly();

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const settings = await getCrmClickToCallSetting();
      this.enabled.set(Boolean(settings.clickToCallEnabled));
    } catch {
      // Keep the current/default flag when loading CRM settings fails.
    }
  }
}
