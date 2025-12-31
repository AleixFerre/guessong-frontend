import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, WritableSignal } from '@angular/core';
import { LibraryInfo, LobbyMode } from '../../../models';

@Component({
  selector: 'app-lobby-setup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby-setup.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-setup.component.scss'],
})
export class LobbySetupComponent {
  @Input({ required: true }) libraries: LibraryInfo[] = [];
  @Input({ required: true }) selectedLibraryInfo: LibraryInfo | null = null;
  @Input({ required: true }) username!: WritableSignal<string>;
  @Input({ required: true }) joinLobbyId!: WritableSignal<string>;
  @Input({ required: true }) mode!: WritableSignal<LobbyMode>;
  @Input({ required: true }) library!: WritableSignal<string>;
  @Input({ required: true }) roundDuration!: WritableSignal<number>;
  @Input({ required: true }) maxPlayers!: WritableSignal<number>;

  @Output() createLobbyRequest = new EventEmitter<void>();
  @Output() joinLobbyRequest = new EventEmitter<void>();
}
