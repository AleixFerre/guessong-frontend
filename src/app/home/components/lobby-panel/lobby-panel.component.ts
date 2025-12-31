import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-lobby-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby-panel.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-panel.component.scss'],
})
export class LobbyPanelComponent {
  @Input({ required: true }) lobby: LobbySnapshot | null = null;
  @Input({ required: true }) isHost = false;

  @Output() startGameRequest = new EventEmitter<void>();
  @Output() skipRequest = new EventEmitter<void>();
}
