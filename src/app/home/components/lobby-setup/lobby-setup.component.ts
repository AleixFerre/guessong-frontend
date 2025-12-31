import { Component, WritableSignal, input, output } from '@angular/core';
import { LibraryInfo, LobbyMode } from '../../../models';

@Component({
  selector: 'app-lobby-setup',
  standalone: true,
  templateUrl: './lobby-setup.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-setup.component.scss'],
})
export class LobbySetupComponent {
  readonly libraries = input.required<LibraryInfo[]>();
  readonly selectedLibraryInfo = input.required<LibraryInfo | null>();
  readonly username = input.required<WritableSignal<string>>();
  readonly joinLobbyId = input.required<WritableSignal<string>>();
  readonly mode = input.required<WritableSignal<LobbyMode>>();
  readonly library = input.required<WritableSignal<string>>();
  readonly roundDuration = input.required<WritableSignal<number>>();
  readonly maxPlayers = input.required<WritableSignal<number>>();
  readonly totalRounds = input.required<WritableSignal<number>>();
  readonly entryMode = input.required<'create' | 'join'>();

  readonly createLobbyRequest = output<void>();
  readonly joinLobbyRequest = output<void>();
}
