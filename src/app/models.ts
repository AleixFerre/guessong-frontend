export type LobbyMode = 'BUZZ' | 'WRITE' | 'ONE_SECOND';

export enum LibraryId {
  ANIME = 'anime',
  OST = 'ost',
  ROCK = 'rock',
}

export interface Player {
  id: string;
  username: string;
  score: number;
  lockedForRound: boolean;
  isHost?: boolean;
}

export interface LobbySnapshot {
  id: string;
  hostId: string;
  settings: {
    mode: LobbyMode;
    library: LibraryId;
    roundDuration: number;
    maxPlayers: number;
    totalRounds: number;
  };
  currentRound: number;
  players: Player[];
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  round: null | {
    status: 'PLAYING' | 'PAUSED' | 'ENDED';
    clipDuration: number;
    startAtServerTs: number;
  };
}

export interface LibraryInfo {
  id: LibraryId;
  name: string;
  description: string;
  trackCount: number;
}

export interface LibraryTrack {
  title: string;
  artist: string;
  duration: number;
}

export interface RoundStartPayload {
  clipUrl: string;
  clipDuration: number;
  startAtServerTs: number;
  mode: LobbyMode;
}

export interface PlayPayload {
  startAtServerTs: number;
  seekToSeconds?: number;
}

export interface PausePayload {
  offsetSeconds: number;
  byPlayerId?: string;
  responseDeadlineServerTs?: number | null;
}

export interface RoundEndPayload {
  reason: 'WIN' | 'TIMEOUT' | 'SKIP';
  winnerId: string | null;
  pointsAwarded: number;
  revealedTrackMeta: { title: string; artist: string };
  leaderboard: Player[];
}

export interface GuessResultPayload {
  playerId: string;
  correct: boolean;
}

export interface BuzzAcceptedPayload {
  playerId: string;
  offsetSeconds: number;
}

export interface BuzzTimeoutPayload {
  playerId: string;
}

export interface EarlyBuzzPayload {
  playerId: string;
}

export interface LobbyUpdatePayload extends LobbySnapshot {}
