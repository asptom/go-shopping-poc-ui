import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { provideAuth } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { authConfig } from './auth/oidc.config';
import { ErrorInterceptor } from './core/error/error.interceptor';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { NotificationContainer } from './core/notification/notification-container.component';

// App initializer to check authentication on startup
function initializeAuth(oidcSecurityService: OidcSecurityService) {
  return () => {
    console.log('Initializing OIDC...');
    // Only check auth if there's a code in the URL (returning from Keycloak)
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has('code');
    const hasState = urlParams.has('state');

    if (hasCode && hasState) {
      console.log('Found auth code in URL, checking authentication...');
      return firstValueFrom(oidcSecurityService.checkAuth()).then((result: any) => {
        console.log('OIDC checkAuth result:', result);
        return result;
      }).catch((error: any) => {
        console.error('OIDC initialization error:', error);
        // Don't throw error on startup - just log it
        return null;
      });
    } else {
      console.log('No auth code in URL, skipping checkAuth on app init');
      // Don't call checkAuth at all on normal app startup to avoid interfering with existing auth state
      return Promise.resolve();
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAuth({
      config: authConfig,
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [OidcSecurityService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    },
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    NotificationContainer
  ]
};
