import { Injectable, computed, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, map, of, catchError, firstValueFrom, tap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';

export interface UserData {
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  [key: string]: unknown;
}

interface PersistedAuthState {
  isAuthenticated: boolean;
  userData: UserData | null;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly STORAGE_KEY = 'auth_state';

  // Derive isAuthenticated directly from the OIDC observable.
  // Seed with persisted state so auth survives page reloads before OIDC resolves.
  // Side-effect: persist or clear storage whenever auth state changes.
  private readonly _isAuthenticated = toSignal(
    this.oidcSecurityService.isAuthenticated$.pipe(
      map(authState => authState.isAuthenticated),
      tap(isAuthenticated => {
        if (!isAuthenticated) {
          this.clearPersistedAuthState();
        }
      }),
      startWith(this.loadPersistedIsAuthenticated()),
    ),
    { initialValue: this.loadPersistedIsAuthenticated() },
  );

  // Derive userData from the OIDC observable.
  // Seed with persisted userData, side-effect persists changes.
  private readonly _userData = toSignal(
    this.oidcSecurityService.userData$.pipe(
      map(state => (state?.userData as UserData) ?? null),
      tap(userData => {
        if (userData && this._isAuthenticated()) {
          this.persistAuthState(userData);
        }
      }),
      startWith(this.loadPersistedUserData()),
    ),
    { initialValue: this.loadPersistedUserData() },
  );

  // Public read-only signals
  readonly isAuthenticated = computed(() => this._isAuthenticated() ?? false);
  readonly userData = computed(() => this._userData() ?? null);
  readonly userFirstName = computed(
    () => this._userData()?.given_name as string
      || (this._userData()?.name as string)?.split(' ')[0]
      || 'User',
  );

  // ── Private storage helpers ──────────────────────────────────────────────

  private loadPersistedIsAuthenticated(): boolean {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as PersistedAuthState;
        return state.isAuthenticated === true;
      }
    } catch {
      // Storage unavailable or corrupt — treat as unauthenticated
    }
    return false;
  }

  private loadPersistedUserData(): UserData | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as PersistedAuthState;
        return state.isAuthenticated ? (state.userData ?? null) : null;
      }
    } catch {
      // Storage unavailable or corrupt
    }
    return null;
  }

  private persistAuthState(userData: UserData): void {
    try {
      const state: PersistedAuthState = {
        isAuthenticated: true,
        userData,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable — non-fatal
    }
  }

  private clearPersistedAuthState(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // ── Public actions ───────────────────────────────────────────────────────

  login(): void {
    this.oidcSecurityService.authorize();
  }

  async logout(): Promise<void> {
    try {
      const idToken = await firstValueFrom(this.getIdToken());
      this.clearPersistedAuthState();
      if (idToken) {
        const logoutUrl =
          `${environment.keycloak.issuer}/protocol/openid-connect/logout` +
          `?id_token_hint=${idToken}` +
          `&post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
        window.location.href = logoutUrl;
      } else {
        this.oidcSecurityService.logoff();
      }
    } catch (error) {
      console.error('Logout error:', error);
      this.clearPersistedAuthState();
      this.oidcSecurityService.logoff();
    }
  }

  getAccessToken(): Observable<string> {
    return this.oidcSecurityService.getAccessToken().pipe(map(token => token ?? ''));
  }

  getIdToken(): Observable<string> {
    return this.oidcSecurityService.getIdToken().pipe(map(token => token ?? ''));
  }

  checkAuth(): Observable<boolean> {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('code') && urlParams.has('state')) {
      return this.oidcSecurityService.checkAuth().pipe(
        map(result => result.isAuthenticated),
        catchError(error => {
          console.error('checkAuth error:', error);
          return of(false);
        }),
      );
    }

    if (this.loadPersistedIsAuthenticated()) {
      return of(true);
    }

    return this.oidcSecurityService.checkAuth().pipe(
      map(result => result.isAuthenticated),
      catchError(error => {
        console.error('OIDC checkAuth error:', error);
        return of(false);
      }),
    );
  }
}
