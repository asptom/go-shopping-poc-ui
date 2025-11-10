import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationContainer } from './core/notification/notification-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationContainer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

}
