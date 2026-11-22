import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../../public/i18n/en.json';
import { RouteError } from './route-error';

it('updates the route error title and description while keeping the home link', () => {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(RouteError);
  const host: HTMLElement = fixture.nativeElement;
  for (const kind of ['notFound', 'forbidden'] as const) {
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    expect(host.querySelector('h1')?.textContent?.trim()).toBe(en.errors[kind].title);
    expect(host.querySelector('p')?.textContent?.trim()).toBe(en.errors[kind].text);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/');
  }
});
