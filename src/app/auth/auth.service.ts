import { Injectable, signal, computed, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, map, of, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserData {
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly STORAGE_KEY = 'auth_state';

  // Signals for reactive state management
  private readonly _isAuthenticated = signal(false);
  private readonly _userData = signal<UserData | null>(null);

  // Computed signals
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly userData = this._userData.asReadonly();
  readonly userFirstName = computed(() => this._userData()?.given_name || this._userData()?.name?.split(' ')[0] || 'User');

  constructor() {
    // Load persisted auth state on startup
    this.loadPersistedAuthState();

    // Subscribe to authentication state changes
    this.oidcSecurityService.isAuthenticated$.subscribe(isAuthenticated => {
      console.log('OIDC Auth state changed:', isAuthenticated);

      // Only update if OIDC service has valid authentication OR if it's explicitly setting to false
      // Don't let OIDC service override persisted authenticated state with false
      if (isAuthenticated.isAuthenticated || !this.hasPersistedAuthState()) {
        this._isAuthenticated.set(isAuthenticated.isAuthenticated);
        if (!isAuthenticated.isAuthenticated) {
          // Clear persisted state only when explicitly logging out
          this.clearPersistedAuthState();
        }
      } else {
        console.log('Ignoring OIDC false state - using persisted authentication');
      }
    });

    // Subscribe to user data changes
    this.oidcSecurityService.userData$.subscribe(userData => {
      console.log('OIDC User data changed:', userData);

      // Only update user data if OIDC has valid data or we're not authenticated
      if (userData.userData || !this._isAuthenticated()) {
        this._userData.set(userData.userData as UserData);
        this.persistAuthState();
      }
    });

    // Subscribe to check session changed
    this.oidcSecurityService.checkSessionChanged$.subscribe(checkSessionChanged => {
      console.log('Check session changed:', checkSessionChanged);
    });
  }

  private hasPersistedAuthState(): boolean {
    try {
      const persisted = localStorage.getItem(this.STORAGE_KEY);
      if (persisted) {
        const authState = JSON.parse(persisted);
        return authState.isAuthenticated === true;
      }
    } catch (error) {
      console.error('Error checking persisted auth state:', error);
    }
    return false;
  }

  private clearPersistedAuthState(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Cleared persisted auth state');
  }

  private loadPersistedAuthState(): void {
    try {
      const persisted = localStorage.getItem(this.STORAGE_KEY);
      if (persisted) {
        const authState = JSON.parse(persisted);
        console.log('Loaded persisted auth state:', authState);
        if (authState.isAuthenticated) {
          this._isAuthenticated.set(true);
          this._userData.set(authState.userData);
        }
      }
    } catch (error) {
      console.error('Error loading persisted auth state:', error);
    }
  }

  private persistAuthState(): void {
    try {
      const authState = {
        isAuthenticated: this._isAuthenticated(),
        userData: this._userData(),
        timestamp: Date.now()
      };
      if (authState.isAuthenticated) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authState));
        console.log('Persisted auth state:', authState);
      } else {
        // Don't persist false state - let clearPersistedAuthState handle clearing
        console.log('Not persisting false auth state');
      }
    } catch (error) {
      console.error('Error persisting auth state:', error);
    }
  }

  login(): void {
    console.log('Login called');
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    console.log('Logout called');
    this.getIdToken().subscribe(idToken => {
      if (idToken) {
        const logoutUrl = `${environment.keycloak.issuer}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${encodeURIComponent(environment.keycloak.redirectUri)}`;
        // Clear local state
        localStorage.removeItem(this.STORAGE_KEY);
        this._isAuthenticated.set(false);
        this._userData.set(null);
        // Redirect to server logout
        window.location.href = logoutUrl;
      } else {
        // Fallback to client logout
        localStorage.removeItem(this.STORAGE_KEY);
        this._isAuthenticated.set(false);
        this._userData.set(null);
        this.oidcSecurityService.logoff();
      }
    });
  }

  getAccessToken(): Observable<string> {
    return this.oidcSecurityService.getAccessToken().pipe(
      map(token => token || '')
    );
  }

  getIdToken(): Observable<string> {
    return this.oidcSecurityService.getIdToken().pipe(
      map(token => token || '')
    );
  }

  checkAuth(): Observable<boolean> {
    console.log('checkAuth called, URL:', window.location.href);
    // Check URL for auth code (when returning from Keycloak)
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has('code');
    const hasState = urlParams.has('state');

    console.log('URL params - code:', hasCode, 'state:', hasState);

    // If there's an auth code, process the callback
    if (hasCode && hasState) {
      console.log('Found auth code, processing callback');
      return this.oidcSecurityService.checkAuth().pipe(
        map(result => {
          console.log('checkAuth result:', result);
          return result.isAuthenticated;
        }),
        catchError(error => {
          console.error('checkAuth error:', error);
          return of(false);
        })
      );
    }

    // For route protection checks, use persisted state if available
    const currentAuthState = this.isAuthenticated();
    console.log('No auth code, current auth state:', currentAuthState);

    // If we're currently authenticated (from persisted state), allow access
    if (currentAuthState) {
      console.log('User is authenticated via persisted state, allowing access');
      return of(true);
    }

    // Otherwise, check with OIDC service (but don't let it override persisted state)
    return this.oidcSecurityService.checkAuth().pipe(
      map(result => {
        console.log('OIDC checkAuth result for route protection:', result);
        // Only return false if OIDC also says false AND we have no persisted state
        return result.isAuthenticated || currentAuthState;
      }),
      catchError(error => {
        console.error('OIDC checkAuth error for route protection:', error);
        // If OIDC check fails, fall back to persisted state
        return of(currentAuthState);
      })
    );
  }
}