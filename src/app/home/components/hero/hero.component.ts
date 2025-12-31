import { Component, input, output, signal } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrls: ['../../home.shared.scss', './hero.component.scss'],
})
export class HeroComponent {
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly wsStatus = input.required<string>();
  readonly errorMessage = input.required<string | null>();
  readonly leave = output<void>();
  readonly copied = signal(false);

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

  formatMode(mode: LobbySnapshot['settings']['mode']) {
    switch (mode) {
      case 'BUZZ':
        return 'Timbre';
      case 'WRITE':
        return 'Escribir';
      case 'ONE_SECOND':
        return '1s';
      default:
        return mode;
    }
  }

  async copyLobbyCode(code: string) {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // noop
    }
  }
}
