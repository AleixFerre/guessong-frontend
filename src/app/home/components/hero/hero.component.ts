import { Component, input, output } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrls: ['../../home.shared.scss', './hero.component.scss'],
})
export class HeroComponent {
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly pingMs = input.required<number | null>();
  readonly leave = output<void>();

  formatStatus(status: string) {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  }
  formatPing(pingMs: number | null) {
    if (pingMs === null || Number.isNaN(pingMs)) {
      return '-- ms';
    }
    return `${pingMs} ms`;
  }
}
