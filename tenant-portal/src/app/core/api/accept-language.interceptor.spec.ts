import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { acceptLanguageInterceptor } from './accept-language.interceptor';

describe('acceptLanguageInterceptor', () => {
  let active = 'en';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: { getActiveLang: () => active } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the active language on every request', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    http.get('/api/a').subscribe();
    expect(ctrl.expectOne('/api/a').request.headers.get('Accept-Language')).toBe('en');

    active = 'ar';
    http.get('/api/b').subscribe();
    expect(ctrl.expectOne('/api/b').request.headers.get('Accept-Language')).toBe('ar');
  });

  it('keeps a header the caller set', () => {
    const http = TestBed.inject(HttpClient);
    http.get('/api/c', { headers: { 'Accept-Language': 'en' } }).subscribe();
    active = 'ar';
    expect(TestBed.inject(HttpTestingController).expectOne('/api/c').request.headers.get('Accept-Language')).toBe('en');
  });
});
