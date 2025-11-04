import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()" *ngIf="isOpen()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ title() }}</h3>
          <button class="close-button" (click)="close.emit()">&times;</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./modal.scss']
})
export class Modal {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly close = output<void>();
}