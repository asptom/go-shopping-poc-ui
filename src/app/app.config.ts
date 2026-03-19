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

// App initializer: only process the OIDC callback when returning from Keycloak.
// On normal page loads we skip checkAuth entirely to avoid overwriting persisted auth state.
function initializeAuth(oidcSecurityService: OidcSecurityService) {
  return (): Promise<unknown> => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && urlParams.has('state')) {
      return firstValueFrom(oidcSecurityService.checkAuth()).catch(() => null);
    }
    return Promise.resolve();
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
