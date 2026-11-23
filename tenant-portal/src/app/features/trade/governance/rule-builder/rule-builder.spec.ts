import { Component, Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import arGlobal from '../../../../../../public/i18n/ar.json';
import enGlobal from '../../../../../../public/i18n/en.json';
import arGovernance from '../../../../../../public/i18n/trade-governance/ar.json';
import enGovernance from '../../../../../../public/i18n/trade-governance/en.json';
import arPolicy from '../../../../../../public/i18n/trade-gov-policy/ar.json';
import enPolicy from '../../../../../../public/i18n/trade-gov-policy/en.json';
import { LanguageState } from '../../../../core/i18n/language';
import type { PolicyContent } from '../policy.model';
import { type PolicyFactDefinition, operatorsFor } from '../policy.registry';
import { RuleBuilder, validatePolicyContentClient } from './rule-builder';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...enGlobal, governance: enGovernance, policy: enPolicy },
  ar: { ...arGlobal, governance: arGovernance, policy: arPolicy },
};

@Injectable()
class RuleBuilderTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

@Component({
  imports: [RuleBuilder],
  template: `
    <app-rule-builder
      [(content)]="content"
      [kind]="'PURCHASE_APPROVAL'"
      [facts]="facts"
      [factsByKind]="factsByKind"
    />
  `,
})
class HostComponent {
  readonly facts: readonly PolicyFactDefinition[] = [
    { key: 'document.total', type: 'decimal' },
    { key: 'document.kind', type: 'string' },
    { key: 'custom.untranslated_flag', type: 'boolean' },
  ];
  readonly factsByKind = {
    PURCHASE_APPROVAL: ['document.total', 'document.kind', 'custom.untranslated_flag'],
  };
  content: PolicyContent = {
    rules: [
      {
        code: 'HIGH_TOTAL',
        priority: 10,
        all: [{ fact: 'document.total', operator: 'GT', value: '5000' }],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'ABOVE_LIMIT',
      },
    ],
    defaultOutcome: 'ALLOW',
  };
}

describe('RuleBuilder (G-3 decimal, G-4 dotted facts & fallback, G-7 selectedValue omitted)', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: RuleBuilderTranslocoLoader,
        }),
        { provide: LanguageState, useValue: { current: signal<'en' | 'ar'>('en') } },
      ],
    });
    TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS['en'], 'en');
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('offers numeric operators for decimal fact type and validates decimal thresholds', () => {
    expect(operatorsFor('decimal')).toEqual(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN']);
    const validErrs = validatePolicyContentClient(fixture.componentInstance.content, fixture.componentInstance.facts);
    expect(validErrs).toEqual({});

    const badContent: PolicyContent = {
      ...fixture.componentInstance.content,
      rules: [
        {
          ...fixture.componentInstance.content.rules[0],
          all: [{ fact: 'document.total', operator: 'GT', value: 'not-a-decimal' }],
        },
      ],
    };
    const badErrs = validatePolicyContentClient(badContent, fixture.componentInstance.facts);
    expect(badErrs['rules[0].all[0].value']).toBe('policy.rules.validation.genericInvalid');
  });

  it('renders translated dotted metadata facts and falls back to raw dotted key when untranslated', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Document total');
    expect(text).toContain('custom.untranslated_flag');
  });

  it('omits selectedValue and defaultSelectedValue when outcome is not SELECT (G-7)', () => {
    const rb = fixture.debugElement.children[0].componentInstance as unknown as {
      addRule: () => void;
      onRuleOutcomeChange: (i: number, v: string | null) => void;
      onDefaultOutcomeChange: (v: string | null) => void;
    };

    rb.addRule();
    fixture.detectChanges();
    const addedRule = fixture.componentInstance.content.rules[1];
    expect(addedRule.all[0].fact).toBe('document.total');
    expect('selectedValue' in addedRule).toBe(false);

    rb.onRuleOutcomeChange(1, 'SELECT');
    fixture.detectChanges();
    expect(fixture.componentInstance.content.rules[1].selectedValue).toBe('');

    rb.onRuleOutcomeChange(1, 'ALLOW');
    fixture.detectChanges();
    expect('selectedValue' in fixture.componentInstance.content.rules[1]).toBe(false);

    rb.onDefaultOutcomeChange('SELECT');
    fixture.detectChanges();
    expect(fixture.componentInstance.content.defaultSelectedValue).toBe('');

    rb.onDefaultOutcomeChange('DENY');
    fixture.detectChanges();
    expect('defaultSelectedValue' in fixture.componentInstance.content).toBe(false);
  });
});
