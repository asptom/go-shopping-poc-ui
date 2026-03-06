import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, map, take, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const path = route.url.join('/');
    console.log('AuthGuard.canActivate called for path:', path);
    
    return this.authService.checkAuth().pipe(
      take(1),
      catchError(error => {
        console.error('AuthGuard error:', error);
        this.router.navigate(['/home']);
        return of(false);
      }),
      map(isAuthenticated => {
        console.log('AuthGuard checkAuth result:', isAuthenticated, 'for path:', path);
        if (isAuthenticated) {
          return true;
        } else {
          this.router.navigate(['/home']);
          return false;
        }
      })
    );
  }
}