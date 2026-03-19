import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, take } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * Attaches the OIDC Bearer token to all requests targeting the API base URL.
 * Requests to other origins (e.g. OIDC discovery endpoints) are passed through unchanged.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');

  if (!isApiRequest) {
    return next(req);
  }

  const authService = inject(AuthService);

  return authService.getAccessToken().pipe(
    take(1),
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      );
    })
  );
};
