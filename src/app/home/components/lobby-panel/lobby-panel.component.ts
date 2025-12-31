import { Component, input, output } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-lobby-panel',
  standalone: true,
  templateUrl: './lobby-panel.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-panel.component.scss'],
})
export class LobbyPanelComponent {
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly isHost = input.required<boolean>();

  readonly startGameRequest = output<void>();
  readonly skipRequest = output<void>();
}
