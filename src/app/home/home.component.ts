import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import config from '../config.json';
import {
  BuzzAcceptedPayload,
  BuzzTimeoutPayload,
  EarlyBuzzPayload,
  GuessResultPayload,
  LibraryId,
  LibraryInfo,
  LibraryTrack,
  LobbySnapshot,
  PausePayload,
  PlayPayload,
  RoundEndPayload,
  RoundStartPayload,
} from '../models';
import { ApiService } from '../services/api.service';
import { AudioService } from '../services/audio.service';
import { ToastService } from '../services/toast.service';
import { WsService } from '../services/ws.service';
import { GamePanelComponent } from './components/game-panel/game-panel.component';
import { HeroComponent } from './components/hero/hero.component';
import { LobbyPanelComponent } from './components/lobby-panel/lobby-panel.component';
import { LobbySetupComponent } from './components/lobby-setup/lobby-setup.component';

const MAX_ROUND_DURATION_SEC = 30;
const MAX_PLAYERS = 10;
const MAX_GUESSES_PER_ROUND = 10;
const DEFAULT_GUESSES_PER_ROUND = 3;
const MAX_LOCKOUT_SECONDS = 30;
const DEFAULT_LOCKOUT_SECONDS = 2;
const DEFAULT_RESPONSE_SECONDS = 10;
const MAX_RESPONSE_SECONDS = 60;

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
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private libraryTracksRequestId = 0;
  private lastLoadedLibraryId: LibraryId | null = null;

  readonly libraries = signal<LibraryInfo[]>([]);
  readonly username = signal('');
  readonly joinLobbyId = signal('');
  readonly library = signal<LibraryId | ''>('');
  readonly roundDuration = signal(30);
  readonly penalty = signal(0);
  readonly maxPlayers = signal(8);
  readonly totalRoundsInput = signal(5);
  readonly maxGuessesPerRound = signal(DEFAULT_GUESSES_PER_ROUND);
  readonly lockoutSeconds = signal(DEFAULT_LOCKOUT_SECONDS);
  readonly responseSeconds = signal(DEFAULT_RESPONSE_SECONDS);
  readonly createPassword = signal('');
  readonly joinPassword = signal('');
  readonly lobbyPassword = signal('');
  readonly entryMode = signal<'create' | 'join' | null>(null);

  readonly lobby = signal<LobbySnapshot | null>(null);
  readonly playerId = signal<string | null>(null);
  readonly libraryTracks = signal<LibraryTrack[]>([]);
  readonly libraryTracksLoading = signal(false);
  readonly excludedGuessOptions = signal<string[]>([]);
  readonly guessCounts = signal<Record<string, number>>({});
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
  readonly volume = signal(this.audio.getVolume() * 100);
  readonly audioUnavailable = signal(false);
  readonly dissolveCountdown = signal(0);
  readonly showFinalOverlay = signal(false);
  readonly rematchRequested = signal(false);
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
  readonly remainingGuesses = computed(() => {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses <= 0) {
      return null;
    }
    const playerId = this.playerId();
    if (!playerId) {
      return maxGuesses;
    }
    const used = this.guessCounts()[playerId] ?? 0;
    return Math.max(0, maxGuesses - used);
  });
  readonly roundGuessTracks = computed(() => {
    const excluded = new Set(this.excludedGuessOptions());
    return this.libraryTracks().filter((track) => {
      const label = this.formatGuessOption(track);
      const normalized = this.normalizeGuessOption(label);
      return normalized ? !excluded.has(normalized) : true;
    });
  });
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
    const maxGuesses = this.maxGuessesPerRound();
    const remaining = this.remainingGuesses();
    const hasGuessesLeft = maxGuesses <= 0 || remaining === null || remaining > 0;
    return this.roundStatus() === 'PLAYING' && !player.lockedForRound && hasGuessesLeft;
  });

  readonly canGuess = computed(() => {
    const lobby = this.lobby();
    const status = this.roundStatus();
    if (!lobby || (status !== 'PLAYING' && status !== 'PAUSED')) {
      return false;
    }
    return this.activeBuzzPlayerId() === this.playerId();
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
    this.applyLobbyLinkFromUrl();

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
      const lobby = this.lobby();
      if (!lobby || this.libraries().length) {
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
      const duration = this.roundDuration();
      if (duration > MAX_ROUND_DURATION_SEC) {
        this.roundDuration.set(MAX_ROUND_DURATION_SEC);
      } else if (duration < 5) {
        this.roundDuration.set(5);
      }

      const players = this.maxPlayers();
      if (players > MAX_PLAYERS) {
        this.maxPlayers.set(MAX_PLAYERS);
      } else if (players < 2) {
        this.maxPlayers.set(2);
      }

      const maxGuesses = this.maxGuessesPerRound();
      if (maxGuesses > MAX_GUESSES_PER_ROUND) {
        this.maxGuessesPerRound.set(MAX_GUESSES_PER_ROUND);
      } else if (maxGuesses < 0) {
        this.maxGuessesPerRound.set(0);
      }

      const lockoutSeconds = this.lockoutSeconds();
      if (lockoutSeconds > MAX_LOCKOUT_SECONDS) {
        this.lockoutSeconds.set(MAX_LOCKOUT_SECONDS);
      } else if (lockoutSeconds < 0) {
        this.lockoutSeconds.set(0);
      }

      const responseSeconds = this.responseSeconds();
      if (responseSeconds > MAX_RESPONSE_SECONDS) {
        this.responseSeconds.set(MAX_RESPONSE_SECONDS);
      } else if (responseSeconds < 0) {
        this.responseSeconds.set(0);
      }
    });

    effect(() => {
      const info = this.selectedLibraryInfo();
      if (!info) {
        return;
      }
      const maxRounds = Math.max(1, info.trackCount);
      const rounds = this.totalRoundsInput();
      if (rounds > maxRounds) {
        this.totalRoundsInput.set(maxRounds);
      } else if (rounds < 1) {
        this.totalRoundsInput.set(1);
      }
    });

    effect(() => {
      const lobby = this.lobby();
      if (!lobby || lobby.state !== 'FINISHED') {
        this.clearDissolveCountdown();
        this.showFinalOverlay.set(false);
        this.rematchRequested.set(false);
        return;
      }
      if (!this.dissolveTimeoutId) {
        this.startDissolveCountdown();
      }
      this.showFinalOverlay.set(true);
    });

    const interval = window.setInterval(() => this.tickElapsed(), 250);
    this.destroyRef.onDestroy(() => window.clearInterval(interval));
    this.destroyRef.onDestroy(() => this.clearDissolveCountdown());
  }

  async createLobby() {
    const username = this.username().trim();
    const password = this.createPassword().trim();
    if (!username) {
      this.toast.show('Elige un nombre primero.', 'error');
      return;
    }
    if (password.length < 5) {
      this.toast.show('La contraseña debe tener al menos 5 caracteres.', 'error');
      return;
    }
    const library = this.library();
    if (!library) {
      this.toast.show('Selecciona una biblioteca primero.', 'error');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.api.createLobby({
          username,
          password,
          mode: 'BUZZ',
          library,
          roundDuration: this.roundDuration(),
          penalty: this.penalty(),
          maxPlayers: this.maxPlayers(),
          totalRounds: this.totalRoundsInput(),
          maxGuessesPerRound: this.maxGuessesPerRound(),
          lockoutSeconds: this.lockoutSeconds(),
          responseSeconds: this.responseSeconds(),
        }),
      );
      this.lobbyPassword.set(password);
      this.handleLobbyResponse(response);
    } catch (_error) {
      this.toast.show('No se pudo crear la sala.', 'error');
    }
  }

  async joinLobby() {
    const username = this.username().trim();
    const password = this.joinPassword().trim();
    const lobbyId = this.joinLobbyId().trim();
    if (!username || !lobbyId) {
      this.toast.show('Se requiere nombre y codigo de sala.', 'error');
      return;
    }
    if (password.length < 5) {
      this.toast.show('La contraseña debe tener al menos 5 caracteres.', 'error');
      return;
    }

    try {
      const response = await firstValueFrom(this.api.joinLobby(lobbyId, username, password));
      this.lobbyPassword.set(password);
      this.handleLobbyResponse(response);
    } catch (error) {
      const serverMessage =
        typeof (error as { error?: { error?: string } })?.error?.error === 'string'
          ? (error as { error?: { error?: string } }).error?.error
          : '';
      if (serverMessage === 'Lobby not found') {
        this.toast.show('La sala no existe', 'error');
        return;
      }
      this.toast.show('No se pudo unir a la sala.', 'error');
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

  requestRematch() {
    if (this.rematchRequested()) {
      return;
    }
    this.rematchRequested.set(true);
    this.ws.send('REMATCH', {});
  }

  updateLobbySettings() {
    const lobby = this.lobby();
    if (!lobby || lobby.state !== 'WAITING' || lobby.hostId !== this.playerId()) {
      return;
    }
    const library = this.library();
    if (!library) {
      this.toast.show('Selecciona una biblioteca primero.', 'error');
      return;
    }
    this.ws.send('UPDATE_SETTINGS', {
      library,
      roundDuration: this.roundDuration(),
      penalty: this.penalty(),
      maxPlayers: this.maxPlayers(),
      totalRounds: this.totalRoundsInput(),
      maxGuessesPerRound: this.maxGuessesPerRound(),
      lockoutSeconds: this.lockoutSeconds(),
      responseSeconds: this.responseSeconds(),
    });
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
    this.excludedGuessOptions.set([]);
    this.guessCounts.set({});
    this.clearDissolveCountdown();
    this.lobbyPassword.set('');
    this.rematchRequested.set(false);
  }

  private startDissolveCountdown() {
    this.clearDissolveCountdown();
    this.dissolveCountdown.set(10);
    this.dissolveIntervalId = window.setInterval(() => {
      this.dissolveCountdown.update((value) => Math.max(0, value - 1));
    }, 1000);
    this.dissolveTimeoutId = window.setTimeout(() => this.clearDissolveCountdown(), 10000);
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
    } catch (_error) {
      this.toast.show('No se pudieron cargar las bibliotecas.', 'error');
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
    } catch (_error) {
      if (requestId !== this.libraryTracksRequestId) {
        this.libraryTracksLoading.set(false);
        return;
      }
      this.libraryTracks.set([]);
      this.libraryTracksLoading.set(false);
      this.toast.show('No se pudieron cargar las canciones.', 'error');
    }
  }

  private handleLobbyResponse(response: {
    lobbyId: string;
    playerId: string;
    lobbyState: LobbySnapshot;
  }) {
    this.lobby.set(response.lobbyState);
    this.syncLobbySettings(response.lobbyState);
    this.guessCounts.set({});
    this.playerId.set(response.playerId);
    this.joinLobbyId.set(response.lobbyId);
    this.roundStatus.set('IDLE');
    this.roundResult.set(null);
    this.excludedGuessOptions.set([]);
    this.connectSocket(response.lobbyId, response.playerId);
  }

  private connectSocket(lobbyId: string, playerId: string) {
    const baseUrl = config.isProd ? config.BACKEND_URL_PROD : config.BACKEND_URL_LOCAL;
    const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/ws`;
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
        this.applyLobbyUpdate(payload as LobbySnapshot);
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
        this.toast.show(payload?.message ?? 'Error inesperado del servidor.', 'error');
        break;
      case 'LOBBY_DISSOLVED':
        this.leaveLobby();
        this.toast.show(
          payload?.reason === 'REMATCH' ? 'No entraste en la revancha.' : 'La sala se disolvió.',
          'info',
        );
        break;
      default:
        break;
    }
  }

  private onRoundStart(payload: RoundStartPayload) {
    this.roundResult.set(null);
    this.notifications.set([]);
    this.excludedGuessOptions.set([]);
    this.guessCounts.set({});
    this.roundStatus.set('PLAYING');
    this.roundStartAt.set(payload.startAtServerTs);
    this.roundDurationSec.set(this.lobby()?.settings.roundDuration ?? 30);
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
      const guessText = payload.guessText?.trim();
      if (guessText) {
        const normalized = this.normalizeGuessOption(guessText);
        if (normalized) {
          const excluded = this.excludedGuessOptions();
          if (!excluded.includes(normalized)) {
            this.excludedGuessOptions.set([...excluded, normalized]);
          }
        }
      }
      const guessLabel = guessText ? `: ${guessText}` : '';
      this.addNotice(`${player?.username ?? 'Jugador'} fallo la respuesta${guessLabel}.`);
    }
    this.incrementGuessCount(payload.playerId);
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
    if (payload.winnerId) {
      this.incrementGuessCount(payload.winnerId);
    }
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

  private incrementGuessCount(playerId: string) {
    if (!playerId) {
      return;
    }
    this.guessCounts.update((counts) => ({
      ...counts,
      [playerId]: (counts[playerId] ?? 0) + 1,
    }));
  }

  private applyLobbyUpdate(nextLobby: LobbySnapshot) {
    const prevLobby = this.lobby();
    if (
      prevLobby?.state === 'FINISHED' &&
      nextLobby.state === 'WAITING' &&
      nextLobby.currentRound === 0
    ) {
      const resetPlayers = nextLobby.players.map((player) => ({
        ...player,
        score: 0,
        lockedForRound: false,
        lockedUntilMs: null,
      }));
      const updatedLobby = { ...nextLobby, players: resetPlayers };
      this.lobby.set(updatedLobby);
      this.syncLobbySettings(updatedLobby);
      this.guessCounts.set({});
      return;
    }
    if (nextLobby.state === 'WAITING') {
      this.guessCounts.set({});
    }
    this.lobby.set(nextLobby);
    this.syncLobbySettings(nextLobby);
  }

  private syncLobbySettings(lobby: LobbySnapshot) {
    if (lobby.state !== 'WAITING' && lobby.state !== 'IN_GAME' && lobby.state !== 'FINISHED') {
      return;
    }
    this.library.set(lobby.settings.library);
    this.roundDuration.set(lobby.settings.roundDuration);
    this.penalty.set(lobby.settings.penalty);
    this.maxPlayers.set(lobby.settings.maxPlayers);
    this.totalRoundsInput.set(lobby.settings.totalRounds);
    this.maxGuessesPerRound.set(lobby.settings.maxGuessesPerRound ?? DEFAULT_GUESSES_PER_ROUND);
    this.lockoutSeconds.set(lobby.settings.lockoutSeconds ?? DEFAULT_LOCKOUT_SECONDS);
    this.responseSeconds.set(lobby.settings.responseSeconds ?? DEFAULT_RESPONSE_SECONDS);
  }

  private resetLobbyForm() {
    this.username.set('');
    this.joinLobbyId.set('');
    const firstLibrary = this.libraries()[0]?.id ?? '';
    this.library.set(firstLibrary);
    this.roundDuration.set(30);
    this.penalty.set(0);
    this.maxPlayers.set(8);
    this.totalRoundsInput.set(5);
    this.maxGuessesPerRound.set(DEFAULT_GUESSES_PER_ROUND);
    this.lockoutSeconds.set(DEFAULT_LOCKOUT_SECONDS);
    this.responseSeconds.set(DEFAULT_RESPONSE_SECONDS);
    this.createPassword.set('');
    this.joinPassword.set('');
  }

  private formatGuessOption(track: LibraryTrack) {
    const artist = track.artist.trim();
    return artist ? `${artist} - ${track.title}` : track.title;
  }

  private normalizeGuessOption(value: string) {
    return value.trim().toLowerCase();
  }

  private applyLobbyLinkFromUrl() {
    if (this.lobby()) {
      return;
    }
    const lobbyId = new URLSearchParams(window.location.search).get('lobby') ?? '';
    if (!lobbyId) {
      return;
    }
    this.joinLobbyId.set(lobbyId);
    this.entryMode.set('join');
  }
}
