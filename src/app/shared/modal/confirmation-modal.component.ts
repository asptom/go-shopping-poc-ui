import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ModalComponent } from './modal.component';

/**
 * Accessible, reusable confirmation dialog.
 * Wraps ModalComponent with confirm/cancel buttons.
 * Use this instead of window.confirm() everywhere.
 *
 * Usage:
 *   <app-confirmation-modal
 *     [isOpen]="showConfirm()"
 *     [title]="'Delete Address'"
 *     [message]="'Are you sure you want to delete this address?'"
 *     [confirmLabel]="'Delete'"
 *     [danger]="true"
 *     (confirmed)="onConfirmed()"
 *     (cancelled)="showConfirm.set(false)">
 *   </app-confirmation-modal>
 */
@Component({
  selector: 'app-confirmation-modal',
  imports: [ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen()" [title]="title()" (close)="cancelled.emit()">
      <p class="confirm-message">{{ message() }}</p>
      <div class="confirm-actions">
        <button
          type="button"
          class="btn-cancel"
          (click)="cancelled.emit()">
          {{ cancelLabel() }}
        </button>
        <button
          type="button"
          [class]="danger() ? 'btn-confirm btn-danger' : 'btn-confirm'"
          (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .confirm-message {
      font-size: 1rem;
      color: #0f1111;
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }

    .confirm-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .btn-cancel,
    .btn-confirm {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 100px;
    }

    .btn-cancel {
      background-color: #e7e9ec;
      color: #0f1111;

      &:hover {
        background-color: #d5d8dc;
      }
    }

    .btn-confirm {
      background-color: #ff9900;
      color: #0f1111;

      &:hover {
        background-color: #e68a00;
      }
    }

    .btn-confirm.btn-danger {
      background-color: #c40000;
      color: white;

      &:hover {
        background-color: #a30000;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input<string>('Confirm');
  readonly message = input.required<string>();
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly danger = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
