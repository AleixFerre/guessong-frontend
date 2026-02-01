import { Component, computed, input, output } from '@angular/core';
import { formatGuessLabel, formatSongGuessLabel } from '../../../game-modes';
import { LibraryId, LibraryTrack, LobbyMode } from '../../../models';

@Component({
  selector: 'app-guess-input',
  standalone: true,
  templateUrl: './guess-input.component.html',
  styleUrl: './guess-input.component.scss',
})
export class GuessInputComponent {
  readonly tracks = input.required<LibraryTrack[]>();
  readonly mode = input.required<LobbyMode>();
  readonly libraryId = input<LibraryId | ''>('');
  readonly disabled = input<boolean>(false);
  readonly guessSelect = output<string>();

  readonly options = computed(() => {
    const libraryId = this.libraryId();
    const mode = this.mode();
    return this.tracks().map((track) =>
      libraryId ? formatGuessLabel(track, mode, libraryId) : formatSongGuessLabel(track),
    );
  });

  selectOption(option: string) {
    this.guessSelect.emit(option);
  }
}
