import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RoundEndPayload } from '../../../models';

type RoundStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'ENDED';

@Component({
  selector: 'app-game-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-panel.component.html',
  styleUrls: ['../../home.shared.scss', './game-panel.component.scss'],
})
export class GamePanelComponent {
  @Input({ required: true }) progressPercent = 0;
  @Input({ required: true }) roundDurationSec = 0;
  @Input({ required: true }) elapsedSeconds = 0;
  @Input({ required: true }) roundStatus: RoundStatus = 'IDLE';
  @Input({ required: true }) canBuzz = false;
  @Input({ required: true }) canGuess = false;
  @Input({ required: true }) roundResult: RoundEndPayload | null = null;
  @Input({ required: true }) notifications: string[] = [];

  @Output() buzzRequest = new EventEmitter<void>();
  @Output() skipRequest = new EventEmitter<void>();
  @Output() guessRequest = new EventEmitter<string>();

  guessText = '';

  formatTime(seconds: number) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${safe}s`;
  }

  sendGuess() {
    const text = this.guessText.trim();
    if (!text) {
      return;
    }
    this.guessRequest.emit(text);
    this.guessText = '';
  }
}
