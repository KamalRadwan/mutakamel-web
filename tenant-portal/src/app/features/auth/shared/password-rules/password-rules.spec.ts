import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PasswordRules } from './password-rules';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

let fixture: ComponentFixture<PasswordRules>;

function icons(): HTMLElement[] {
  return [...fixture.nativeElement.querySelectorAll('ng-icon')];
}

function iconNames(): (string | undefined)[] {
  return fixture.debugElement.queryAll(By.directive(NgIcon)).map(icon => icon.injector.get(NgIcon).name());
}

function setPassword(password: string): void {
  fixture.componentRef.setInput('password', password);
  fixture.detectChanges();
}

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideTransloco({
      config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
      loader: EmptyLoader,
    })],
  });
  fixture = TestBed.createComponent(PasswordRules);
});

afterEach(() => TestBed.resetTestingModule());

describe('PasswordRules', () => {
  it('shows muted circles for unmet rules and green filled checks for met rules', () => {
    setPassword('a');
    expect(iconNames()[0]).toBe('tablerCircle');
    expect(icons()[0].classList.contains('text-text-muted')).toBe(true);
    expect(iconNames()[1]).toBe('tablerCircleCheckFill');
    expect(icons()[1].classList.contains('text-success')).toBe(true);
    expect(icons()[1].classList.contains('text-success-text')).toBe(false);
  });

  it('does not animate on first render, including prefilled met rules', () => {
    fixture.componentRef.setInput('confirm', 'Strong#Pass2026!');
    setPassword('Strong#Pass2026!');
    expect(iconNames().every(name => name === 'tablerCircleCheckFill')).toBe(true);
    expect(icons().some(icon => icon.classList.contains('password-rule-pop'))).toBe(false);
  });

  it('pops only newly met rules once, preserves an active pop, and can pop again after becoming unmet', () => {
    setPassword('');
    expect(icons().some(icon => icon.classList.contains('password-rule-pop'))).toBe(false);
    setPassword('a');
    const lower = icons()[1];
    expect(lower.classList.contains('password-rule-pop')).toBe(true);
    expect(icons().filter(icon => icon.classList.contains('password-rule-pop'))).toHaveLength(1);

    setPassword('ab');
    expect(lower.classList.contains('password-rule-pop')).toBe(true);
    lower.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(lower.classList.contains('password-rule-pop')).toBe(false);
    setPassword('abc');
    expect(lower.classList.contains('password-rule-pop')).toBe(false);

    setPassword('1');
    expect(iconNames()[1]).toBe('tablerCircle');
    expect(lower.classList.contains('password-rule-pop')).toBe(false);
    setPassword('a');
    expect(lower.classList.contains('password-rule-pop')).toBe(true);
  });

  it('animates the match rule only when confirmation starts matching', () => {
    setPassword('Strong#Pass2026!');
    fixture.componentRef.setInput('confirm', 'Strong#Pass2026!');
    fixture.detectChanges();
    expect(icons()[5].classList.contains('password-rule-pop')).toBe(true);
    expect(icons().filter(icon => icon.classList.contains('password-rule-pop'))).toHaveLength(1);
  });

  it('detects transitions after a first render with default inputs', () => {
    fixture.detectChanges();
    setPassword('a');
    expect(icons()[1].classList.contains('password-rule-pop')).toBe(true);
  });

  it('keeps the polite live list, decorative icons and a translated state per row', () => {
    setPassword('a');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ul')?.getAttribute('aria-live')).toBe('polite');
    expect(icons().every(icon => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
    const states = root.querySelectorAll('.sr-only');
    expect(states).toHaveLength(6);
    expect(states[0].textContent).toContain('auth.shared.rules.notMet');
    expect(states[1].textContent).toContain('auth.shared.rules.met');
  });
});
