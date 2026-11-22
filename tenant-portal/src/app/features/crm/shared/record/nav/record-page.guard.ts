import { CanDeactivateFn } from '@angular/router';

export interface CanLeaveRecord {
  canDeactivate(): Promise<boolean>;
}

export const recordCanDeactivate: CanDeactivateFn<CanLeaveRecord> = (component) => {
  return component.canDeactivate();
};
