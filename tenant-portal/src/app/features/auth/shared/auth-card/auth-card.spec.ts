import { Component, Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthCard } from './auth-card';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

@Component({
  imports: [AuthCard],
  template: '<app-auth-card title="Title" [subtitle]="subtitle()"><form id="projected-form"></form></app-auth-card>',
})
class AuthCardHost {
  readonly subtitle = signal('');
}

afterEach(() => TestBed.resetTestingModule());

describe('AuthCard', () => {
  it('keeps its title, optional subtitle and content slot inside the login visual shell', async () => {
    TestBed.configureTestingModule({
      providers: [provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      })],
    });
    const fixture = TestBed.createComponent(AuthCardHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const card = root.querySelector('.login-card')!;
    const title = card.querySelector('h1')!;

    expect(title.textContent).toBe('Title');
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
    expect(card.querySelector('#projected-form')).not.toBeNull();
    expect(card.querySelector('p')).toBeNull();
    expect(root.querySelector('.login-intro')).not.toBeNull();
    expect(root.querySelector('.login-footer')).not.toBeNull();

    fixture.componentInstance.subtitle.set('Subtitle');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(card.querySelector('p')?.textContent).toBe('Subtitle');
    expect(card.querySelector('#projected-form')).not.toBeNull();
  });
});
