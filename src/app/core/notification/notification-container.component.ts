import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../core/notification/notification.service';

@Component({
  selector: 'app-notification-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-container">
      @for (notification of notifications(); track notification.id) {
        <div 
          class="notification notification-{{ notification.type }}"
          [class.fade-in]="true"
          (click)="removeNotification(notification.id)">
          <div class="notification-content">
            @if (notification.title) {
              <div class="notification-title">{{ notification.title }}</div>
            }
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button class="notification-close" (click)="removeNotification(notification.id); $event.stopPropagation()">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
    }

    .notification {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid;
    }

    .notification-success {
      border-left-color: #28a745;
      background: #d4edda;
    }

    .notification-error {
      border-left-color: #dc3545;
      background: #f8d7da;
    }

    .notification-warning {
      border-left-color: #ffc107;
      background: #fff3cd;
    }

    .notification-info {
      border-left-color: #17a2b8;
      background: #d1ecf1;
    }

    .notification-content {
      flex: 1;
      margin-right: 12px;
    }

    .notification-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: #333;
    }

    .notification-message {
      color: #666;
      font-size: 14px;
      line-height: 1.4;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }

    .notification-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #666;
    }

    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @media (max-width: 768px) {
      .notification-container {
        left: 10px;
        right: 10px;
        max-width: none;
      }
    }
  `]
})
export class NotificationContainer {
  private readonly notificationService = inject(NotificationService);
  
  readonly notifications = this.notificationService.notifications$;

  removeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }
}