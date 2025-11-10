import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notifications = signal<Notification[]>([]);
  readonly notifications$ = this.notifications.asReadonly();

  showSuccess(message: string, title?: string, duration: number = 3000): void {
    this.addNotification({
      type: 'success',
      message,
      title,
      duration
    });
  }

  showError(message: string, title?: string, duration: number = 5000): void {
    this.addNotification({
      type: 'error',
      message,
      title,
      duration
    });
  }

  showWarning(message: string, title?: string, duration: number = 4000): void {
    this.addNotification({
      type: 'warning',
      message,
      title,
      duration
    });
  }

  showInfo(message: string, title?: string, duration: number = 3000): void {
    this.addNotification({
      type: 'info',
      message,
      title,
      duration
    });
  }

  private addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date()
    };

    this.notifications.update(current => [...current, newNotification]);

    // Auto-remove notification after duration
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, notification.duration);
    }
  }

  removeNotification(id: string): void {
    this.notifications.update(current => 
      current.filter(notification => notification.id !== id)
    );
  }

  clearAll(): void {
    this.notifications.set([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}