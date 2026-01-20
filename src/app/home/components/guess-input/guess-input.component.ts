import { Component, computed, input, output } from '@angular/core';
import { LibraryTrack } from '../../../models';

@Component({
  selector: 'app-guess-input',
  standalone: true,
  templateUrl: './guess-input.component.html',
  styleUrl: './guess-input.component.scss',
})
export class GuessInputComponent {
  readonly tracks = input.required<LibraryTrack[]>();
  readonly disabled = input<boolean>(false);
  readonly guessSelect = output<string>();

  readonly options = computed(() => this.tracks().map((track) => this.formatGuessOption(track)));

  selectOption(option: string) {
    this.guessSelect.emit(option);
  }

  private formatGuessOption(track: LibraryTrack) {
    const artist = track.artist.trim();
    return artist ? `${artist} - ${track.title}` : track.title;
  }
}
