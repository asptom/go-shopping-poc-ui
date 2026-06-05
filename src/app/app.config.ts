import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  ErrorHandler,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OidcSecurityService, provideAuth } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { createAuthConfig } from './auth/oidc.config';
import { authInterceptor } from './auth/auth.interceptor';
import { ErrorInterceptor } from './core/error/error.interceptor';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { NotificationContainer } from './core/notification/notification-container.component';

// App initializer: always check auth on boot to trigger OIDC re-validation
// from sessionStorage. Previously we short-circuited on non-callback loads
// to "avoid overwriting persisted auth state", but that prevented OIDC from
// re-validating on hard navigations to non-guarded routes (e.g., /products).
// The APP_INITIALIZER blocks rendering until this resolves, ensuring auth
// signals are correct before any component renders.
function initializeAuth(oidcSecurityService: OidcSecurityService) {
  return (): Promise<unknown> => {
    return firstValueFrom(oidcSecurityService.checkAuth()).catch(() => null);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, ErrorInterceptor])
    ),
    provideAuth({ config: createAuthConfig() }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [OidcSecurityService],
      multi: true,
    },
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },
    NotificationContainer,
  ],
};
