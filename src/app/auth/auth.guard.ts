import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map, take, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean> {
    return this.authService.checkAuth().pipe(
      take(1),
      catchError(error => {
        console.error('AuthGuard error:', error);
        // If there's an error checking auth, redirect to home
        this.router.navigate(['/home']);
        return of(false);
      }),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        } else {
          // Redirect to home page if not authenticated
          this.router.navigate(['/home']);
          return false;
        }
      })
    );
  }
}