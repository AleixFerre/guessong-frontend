import { Component, input, output } from '@angular/core';
import { LobbySnapshot, Player } from '../../../models';

@Component({
  selector: 'app-lobby-panel',
  standalone: true,
  templateUrl: './lobby-panel.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-panel.component.scss'],
})
export class LobbyPanelComponent {
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly isHost = input.required<boolean>();
  readonly playersOverride = input<Player[] | null>(null);
  readonly showActions = input<boolean>(true);
  readonly currentPlayerId = input<string | null>(null);

  readonly startGameRequest = output<void>();

  playersToShow() {
    return this.playersOverride() ?? this.lobby()?.players ?? [];
  }
}
