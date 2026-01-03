import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { BACKEND_URL } from '../config.json';
import {
  BuzzAcceptedPayload,
  BuzzTimeoutPayload,
  EarlyBuzzPayload,
  GuessResultPayload,
  LibraryId,
  LibraryInfo,
  LibraryTrack,
  LobbyMode,
  LobbySnapshot,
  PausePayload,
  PlayPayload,
  RoundEndPayload,
  RoundStartPayload,
} from '../models';
import { ApiService } from '../services/api.service';
import { AudioService } from '../services/audio.service';
import { WsService } from '../services/ws.service';
import { GamePanelComponent } from './components/game-panel/game-panel.component';
import { HeroComponent } from './components/hero/hero.component';
import { LobbyPanelComponent } from './components/lobby-panel/lobby-panel.component';
import { LobbySetupComponent } from './components/lobby-setup/lobby-setup.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [GamePanelComponent, HeroComponent, LobbyPanelComponent, LobbySetupComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.shared.scss', './home.component.scss'],
})
export class HomeComponent {
  private readonly api = inject(ApiService);
  readonly ws = inject(WsService);
  private readonly audio = inject(AudioService);
  private readonly destroyRef = inject(DestroyRef);
  private libraryTracksRequestId = 0;
  private lastLoadedLibraryId: LibraryId | null = null;

  readonly libraries = signal<LibraryInfo[]>([]);
  readonly username = signal('');
  readonly joinLobbyId = signal('');
  readonly mode = signal<LobbyMode>('BUZZ');
  readonly library = signal<LibraryId | ''>('');
  readonly roundDuration = signal(30);
  readonly maxPlayers = signal(8);
  readonly totalRoundsInput = signal(5);
  readonly createPassword = signal('');
  readonly joinPassword = signal('');
  readonly lobbyPassword = signal('');
  readonly entryMode = signal<'create' | 'join' | null>(null);

  readonly lobby = signal<LobbySnapshot | null>(null);
  readonly playerId = signal<string | null>(null);
  readonly libraryTracks = signal<LibraryTrack[]>([]);
  readonly libraryTracksLoading = signal(false);
  readonly roundStatus = signal<'IDLE' | 'PLAYING' | 'PAUSED' | 'ENDED'>('IDLE');
  readonly roundStartAt = signal<number | null>(null);
  readonly roundDurationSec = signal(30);
  readonly clipDuration = signal(0);
  readonly pausedOffsetSeconds = signal<number | null>(null);
  readonly buzzDeadlineAt = signal<number | null>(null);
  readonly buzzCountdownSec = signal<number | null>(null);
  readonly elapsedSeconds = signal(0);
  readonly activeBuzzPlayerId = signal<string | null>(null);
  readonly roundResult = signal<RoundEndPayload | null>(null);
  readonly notifications = signal<string[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly volume = signal(this.audio.getVolume() * 100);
  readonly audioUnavailable = signal(false);
  readonly dissolveCountdown = signal(0);
  private dissolveIntervalId?: number;
  private dissolveTimeoutId?: number;
  private readonly init = this.setup();
  readonly viewState = computed(() => {
    const lobby = this.lobby();
    if (!lobby) {
      return 'MENU';
    }
    if (lobby.state === 'IN_GAME') {
      return 'IN_GAME';
    }
    if (lobby.state === 'FINISHED') {
      return 'FINISHED';
    }
    return 'WAITING';
  });
  readonly sortedPlayers = computed(() => {
    const players = this.lobby()?.players ?? [];
    return [...players].sort((a, b) => b.score - a.score);
  });
  readonly currentRound = computed(() => this.lobby()?.currentRound ?? 0);
  readonly totalRoundsDisplay = computed(() => this.lobby()?.settings.totalRounds ?? 0);
  readonly activeBuzzPlayerName = computed(() => {
    const playerId = this.activeBuzzPlayerId();
    if (!playerId) {
      return null;
    }
    return this.lobby()?.players.find((player) => player.id === playerId)?.username ?? null;
  });

  readonly selectedLibraryInfo = computed(
    () => this.libraries().find((lib) => lib.id === this.library()) ?? null,
  );
  readonly activeLibraryId = computed<LibraryId | ''>(
    () => this.lobby()?.settings.library ?? this.library(),
  );

  readonly isHost = computed(() => !!this.lobby() && this.lobby()?.hostId === this.playerId());
  readonly currentPlayer = computed(
    () => this.lobby()?.players.find((player) => player.id === this.playerId()) ?? null,
  );
  readonly canBuzz = computed(() => {
    const lobby = this.lobby();
    const player = this.currentPlayer();
    if (!lobby || !player) {
      return false;
    }
    return (
      lobby.settings.mode === 'BUZZ' && this.roundStatus() === 'PLAYING' && !player.lockedForRound
    );
  });

  readonly canGuess = computed(() => {
    const lobby = this.lobby();
    if (!lobby) {
      return false;
    }
    if (lobby.settings.mode === 'BUZZ') {
      return this.activeBuzzPlayerId() === this.playerId();
    }
    return this.roundStatus() === 'PLAYING';
  });

  readonly progressPercent = computed(() => {
    const duration = this.roundDurationSec();
    if (!duration) {
      return 0;
    }
    const elapsed = Math.min(duration, this.elapsedSeconds());
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  });

  private setup() {
    this.ws.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.handleWsMessage(message.type, message.payload);
    });

    effect(() => {
      const entryMode = this.entryMode();
      if (!entryMode || this.libraries().length) {
        return;
      }
      untracked(() => {
        void this.loadLibraries();
      });
    });

    effect(() => {
      const libraryId = this.activeLibraryId();
      const viewState = this.viewState();
      if (!libraryId || (viewState !== 'IN_GAME' && viewState !== 'FINISHED')) {
        this.libraryTracks.set([]);
        this.libraryTracksLoading.set(false);
        return;
      }
      if (this.libraryTracksLoading()) {
        return;
      }
      if (this.lastLoadedLibraryId === libraryId && this.libraryTracks().length) {
        return;
      }
      untracked(() => {
        void this.loadLibraryTracks(libraryId);
      });
    });

    effect(() => {
      this.audio.setVolume(this.volume() / 100);
    });

    effect(() => {
      const lobby = this.lobby();
      if (!lobby || lobby.state !== 'FINISHED') {
        this.clearDissolveCountdown();
        return;
      }
      if (!this.dissolveTimeoutId) {
        this.startDissolveCountdown();
      }
    });

    const interval = window.setInterval(() => this.tickElapsed(), 250);
    this.destroyRef.onDestroy(() => window.clearInterval(interval));
    this.destroyRef.onDestroy(() => this.clearDissolveCountdown());
  }

  async createLobby() {
    this.errorMessage.set(null);
    const username = this.username().trim();
    const password = this.createPassword().trim();
    if (!username) {
      this.errorMessage.set('Elige un nombre primero.');
      return;
    }
    if (password.length < 5) {
      this.errorMessage.set('La contraseña debe tener al menos 5 caracteres.');
      return;
    }
    const library = this.library();
    if (!library) {
      this.errorMessage.set('Selecciona una biblioteca primero.');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.api.createLobby({
          username,
          password,
          mode: this.mode(),
          library,
          roundDuration: this.roundDuration(),
          maxPlayers: this.maxPlayers(),
          totalRounds: this.totalRoundsInput(),
        }),
      );
      this.lobbyPassword.set(password);
      this.handleLobbyResponse(response);
    } catch (error) {
      this.errorMessage.set('No se pudo crear la sala.');
    }
  }

  async joinLobby() {
    this.errorMessage.set(null);
    const username = this.username().trim();
    const password = this.joinPassword().trim();
    const lobbyId = this.joinLobbyId().trim();
    if (!username || !lobbyId) {
      this.errorMessage.set('Se requiere nombre y codigo de sala.');
      return;
    }
    if (password.length < 5) {
      this.errorMessage.set('La contraseña debe tener al menos 5 caracteres.');
      return;
    }

    try {
      const response = await firstValueFrom(this.api.joinLobby(lobbyId, username, password));
      this.lobbyPassword.set(password);
      this.handleLobbyResponse(response);
    } catch (error) {
      this.errorMessage.set('No se pudo unir a la sala.');
    }
  }

  startGame() {
    this.ws.send('START_GAME', {});
  }

  sendBuzz() {
    this.ws.send('BUZZ', {});
  }

  sendGuess(guessText: string) {
    const text = guessText.trim();
    if (!text) {
      return;
    }
    this.ws.send('GUESS', { guessText: text });
  }

  leaveLobby() {
    this.ws.disconnect();
    this.audio.stop();
    this.lobby.set(null);
    this.playerId.set(null);
    this.roundResult.set(null);
    this.notifications.set([]);
    this.roundStatus.set('IDLE');
    this.activeBuzzPlayerId.set(null);
    this.entryMode.set(null);
    this.audioUnavailable.set(false);
    this.libraryTracksLoading.set(false);
    this.clearDissolveCountdown();
    this.lobbyPassword.set('');
  }

  private startDissolveCountdown() {
    this.clearDissolveCountdown();
    this.dissolveCountdown.set(10);
    this.dissolveIntervalId = window.setInterval(() => {
      this.dissolveCountdown.update((value) => Math.max(0, value - 1));
    }, 1000);
    this.dissolveTimeoutId = window.setTimeout(() => this.leaveLobby(), 10000);
  }

  private clearDissolveCountdown() {
    if (this.dissolveIntervalId) {
      window.clearInterval(this.dissolveIntervalId);
      this.dissolveIntervalId = undefined;
    }
    if (this.dissolveTimeoutId) {
      window.clearTimeout(this.dissolveTimeoutId);
      this.dissolveTimeoutId = undefined;
    }
    this.dissolveCountdown.set(0);
  }

  selectEntryMode(mode: 'create' | 'join') {
    console.log('Resetting lobby form for entry mode selection:', mode);
    this.resetLobbyForm();
    this.entryMode.set(mode);
  }

  resetEntryMode() {
    this.entryMode.set(null);
  }

  updateVolume(value: number) {
    this.volume.set(value);
  }

  private async loadLibraries() {
    try {
      const libs = await firstValueFrom(this.api.listLibraries());
      this.libraries.set(libs);
      if (!this.library() && libs.length) {
        this.library.set(libs[0].id);
      }
    } catch (error) {
      this.errorMessage.set('No se pudieron cargar las bibliotecas.');
    }
  }

  private async loadLibraryTracks(libraryId: LibraryId) {
    const requestId = (this.libraryTracksRequestId += 1);
    this.libraryTracksLoading.set(true);
    this.libraryTracks.set([]);
    try {
      const tracks = await firstValueFrom(this.api.getLibraryTracks(libraryId));
      if (requestId !== this.libraryTracksRequestId) {
        this.libraryTracksLoading.set(false);
        return;
      }
      this.libraryTracks.set(tracks);
      this.lastLoadedLibraryId = libraryId;
      this.libraryTracksLoading.set(false);
    } catch (error) {
      if (requestId !== this.libraryTracksRequestId) {
        this.libraryTracksLoading.set(false);
        return;
      }
      this.libraryTracks.set([]);
      this.libraryTracksLoading.set(false);
      this.addNotice('No se pudieron cargar las canciones.');
    }
  }

  private handleLobbyResponse(response: {
    lobbyId: string;
    playerId: string;
    lobbyState: LobbySnapshot;
  }) {
    this.lobby.set(response.lobbyState);
    this.playerId.set(response.playerId);
    this.joinLobbyId.set(response.lobbyId);
    this.roundStatus.set('IDLE');
    this.roundResult.set(null);
    this.connectSocket(response.lobbyId, response.playerId);
  }

  private connectSocket(lobbyId: string, playerId: string) {
    const wsUrl = `${BACKEND_URL}/ws`;
    this.ws.connect(wsUrl);
    this.ws.send('JOIN_LOBBY', {
      lobbyId,
      playerId,
      username: this.username().trim(),
      password: this.lobbyPassword().trim(),
    });
  }

  private handleWsMessage(type: string, payload: any) {
    switch (type) {
      case 'LOBBY_UPDATE':
        this.lobby.set(payload as LobbySnapshot);
        break;
      case 'ROUND_START':
        this.onRoundStart(payload as RoundStartPayload);
        break;
      case 'PLAY':
        this.onPlay(payload as PlayPayload);
        break;
      case 'PAUSE':
        this.onPause(payload as PausePayload);
        break;
      case 'BUZZ_ACCEPTED':
        this.onBuzzAccepted(payload as BuzzAcceptedPayload);
        break;
      case 'GUESS_RESULT':
        this.onGuessResult(payload as GuessResultPayload);
        break;
      case 'ROUND_END':
        this.onRoundEnd(payload as RoundEndPayload);
        break;
      case 'BUZZ_TIMEOUT':
        this.onBuzzTimeout(payload as BuzzTimeoutPayload);
        break;
      case 'EARLY_BUZZ':
        this.onEarlyBuzz(payload as EarlyBuzzPayload);
        break;
      case 'ERROR':
        this.addNotice(payload?.message ?? 'Error inesperado del servidor.');
        break;
      default:
        break;
    }
  }

  private onRoundStart(payload: RoundStartPayload) {
    this.roundResult.set(null);
    this.roundStatus.set('PLAYING');
    this.roundStartAt.set(payload.startAtServerTs);
    this.roundDurationSec.set(
      payload.mode === 'ONE_SECOND' ? 1 : (this.lobby()?.settings.roundDuration ?? 30),
    );
    this.clipDuration.set(payload.clipDuration);
    this.activeBuzzPlayerId.set(null);
    this.pausedOffsetSeconds.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.audioUnavailable.set(!payload.clipUrl);
    this.audio.loadClip(payload.clipUrl || null, payload.clipDuration);
  }

  private onPlay(payload: PlayPayload) {
    this.roundStatus.set('PLAYING');
    this.pausedOffsetSeconds.set(null);
    this.activeBuzzPlayerId.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    if (payload.startAtServerTs) {
      const seekSeconds = payload.seekToSeconds ?? 0;
      this.roundStartAt.set(payload.startAtServerTs - seekSeconds * 1000);
    }
    this.audio.schedulePlay(
      payload.startAtServerTs,
      this.ws.serverOffsetMs(),
      payload.seekToSeconds ?? 0,
    );
  }

  private onPause(payload: PausePayload) {
    this.roundStatus.set('PAUSED');
    this.pausedOffsetSeconds.set(payload.offsetSeconds);
    this.buzzDeadlineAt.set(payload.responseDeadlineServerTs ?? null);
    this.audio.pauseAt(payload.offsetSeconds);
  }

  private onBuzzAccepted(payload: BuzzAcceptedPayload) {
    this.activeBuzzPlayerId.set(payload.playerId);
  }

  private onGuessResult(payload: GuessResultPayload) {
    if (!payload.correct) {
      const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
      this.addNotice(`${player?.username ?? 'Jugador'} fallo la respuesta.`);
    }
  }

  private onBuzzTimeout(payload: BuzzTimeoutPayload) {
    const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
    this.addNotice(`${player?.username ?? 'Jugador'} se quedo sin tiempo.`);
  }

  private onEarlyBuzz(payload: EarlyBuzzPayload) {
    const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
    this.addNotice(`${player?.username ?? 'Jugador'} pulso antes de empezar.`);
  }

  private onRoundEnd(payload: RoundEndPayload) {
    this.roundStatus.set('ENDED');
    this.roundResult.set(payload);
    this.activeBuzzPlayerId.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.audioUnavailable.set(false);
    this.audio.stop();
  }

  private tickElapsed() {
    const startAt = this.roundStartAt();
    const duration = this.roundDurationSec();
    if (!startAt || !duration) {
      this.elapsedSeconds.set(0);
      this.buzzCountdownSec.set(null);
      return;
    }

    const pausedOffset = this.pausedOffsetSeconds();
    if (pausedOffset !== null) {
      this.elapsedSeconds.set(Math.min(duration, pausedOffset));
      const deadlineAt = this.buzzDeadlineAt();
      if (deadlineAt) {
        const nowServer = Date.now() + this.ws.serverOffsetMs();
        const remaining = Math.max(0, (deadlineAt - nowServer) / 1000);
        this.buzzCountdownSec.set(remaining);
      } else {
        this.buzzCountdownSec.set(null);
      }
      return;
    }

    const nowServer = Date.now() + this.ws.serverOffsetMs();
    const elapsed = Math.max(0, (nowServer - startAt) / 1000);
    this.elapsedSeconds.set(Math.min(duration, elapsed));
    this.buzzCountdownSec.set(null);
  }

  private addNotice(message: string) {
    const next = [...this.notifications().slice(-3), message];
    this.notifications.set(next);
  }

  private resetLobbyForm() {
    this.errorMessage.set(null);
    this.username.set('');
    this.joinLobbyId.set('');
    this.mode.set('BUZZ');
    const firstLibrary = this.libraries()[0]?.id ?? '';
    this.library.set(firstLibrary);
    this.roundDuration.set(30);
    this.maxPlayers.set(8);
    this.totalRoundsInput.set(5);
    this.createPassword.set('');
    this.joinPassword.set('');
  }
}
