import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService, UserData } from '../../auth/auth.service';
import { NotificationService } from '../../core/notification/notification.service';

export interface AuthState {
  isAuthenticated: boolean;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // Private state
  private readonly state = signal<AuthState>({
    isAuthenticated: false,
    userData: null,
    loading: false,
    error: null
  });

  // Public selectors
  readonly isAuthenticated = computed(() => this.state().isAuthenticated);
  readonly userData = computed(() => this.state().userData);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);

  // Computed selectors
  readonly userFirstName = computed(() => {
    const userData = this.state().userData;
    return userData?.given_name || userData?.name?.split(' ')[0] || 'User';
  });
  readonly userEmail = computed(() => this.state().userData?.email || '');
  readonly userFullName = computed(() => {
    const userData = this.state().userData;
    if (!userData) return '';
    const firstName = userData.given_name || '';
    const lastName = userData.family_name || '';
    return `${firstName} ${lastName}`.trim() || userData.name || '';
  });
  readonly userRoles = computed(() => this.state().userData?.roles || []);

  constructor() {
    // Sync with AuthService
    effect(() => {
      this.setState({
        isAuthenticated: this.authService.isAuthenticated(),
        userData: this.authService.userData()
      });
    });
  }

  // Actions
  login(): void {
    this.setState({ loading: true, error: null });
    this.authService.login();
  }

  logout(): void {
    this.setState({ loading: true, error: null });
    this.authService.logout();
    this.notificationService.showInfo('You have been logged out successfully');
  }

  checkAuth(): void {
    this.setState({ loading: true, error: null });
    
    this.authService.checkAuth().subscribe({
      next: (isAuthenticated) => {
        this.setState({ loading: false });
      },
      error: () => {
        this.setState({ 
          loading: false, 
          error: 'Authentication check failed' 
        });
      }
    });
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // Private helper methods
  private setState(partialState: Partial<AuthState>): void {
    this.state.update(currentState => ({ ...currentState, ...partialState }));
  }
}