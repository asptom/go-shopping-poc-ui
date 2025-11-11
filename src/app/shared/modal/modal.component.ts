import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, CdkTrapFocus],
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="close.emit()">
        <div class="modal-content" (click)="$event.stopPropagation()" cdkTrapFocus>
          <div class="modal-header">
            <h3>{{ title() }}</h3>
            <button class="close-button" (click)="close.emit()">&times;</button>
          </div>
          <div class="modal-body">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `,
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly close = output<void>();
}