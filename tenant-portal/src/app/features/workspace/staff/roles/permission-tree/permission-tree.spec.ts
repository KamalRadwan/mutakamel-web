import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, provideTransloco, provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import rolesEn from '../../../../../../../public/i18n/staff-roles/en.json';
import permEn from '../../../../../../../public/i18n/staff-permissions/en.json';
import { fromPermissions } from './permission-tree.model';
import { PermissionTree } from './permission-tree';

class TestLoader {
  getTranslation(path: string) {
    return of(
      path.startsWith('staff-roles/')
        ? rolesEn
        : path.startsWith('staff-permissions/')
          ? permEn
          : {},
    );
  }
}
@Component({
  imports: [PermissionTree, TranslocoPipe],
  providers: [provideTranslocoScope({ scope: 'staff-roles', alias: 'roles' })],
  template: `<app-permission-tree [entries]="[]" [attr.aria-label]="'roles.title' | transloco" />`,
})
class ParentScopeHost {}

describe('Permission tree Core display contract', () => {
  it('uses descriptionI18n as the display name from GET /permissions', () => {
    const result = fromPermissions([
      {
        id: 'p',
        key: 'crm.lead.create',
        nameEn: 'Stored name',
        nameAr: 'اسم مخزن',
        descriptionI18n: { en: 'Approved display name', ar: 'الاسم المعتمد' },
        group: 'crm',
        groupI18n: { en: 'CRM', ar: 'إدارة العملاء' },
      },
    ]);
    expect(result[0].label).toEqual({ en: 'Approved display name', ar: 'الاسم المعتمد' });
  });
  it('keeps the parent scope for bindings on the permission-tree host', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(ParentScopeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('app-permission-tree').getAttribute('aria-label'),
    ).toBe(rolesEn.title);
  });
});
