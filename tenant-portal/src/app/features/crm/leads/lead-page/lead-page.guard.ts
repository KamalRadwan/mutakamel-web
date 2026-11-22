import { CanDeactivateFn } from '@angular/router';
import { CanLeaveRecord, recordCanDeactivate } from '../../shared/record/nav/record-page.guard';
import { LeadsPage } from '../leads-page/leads-page';

export { recordCanDeactivate } from '../../shared/record/nav/record-page.guard';
export type { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';

export const leadPageCanDeactivate: CanDeactivateFn<CanLeaveRecord> = recordCanDeactivate;

export const leadsPageCanDeactivate: CanDeactivateFn<LeadsPage> = (component) => {
  return component.leadModal().canDeactivate();
};
