import { LibraryId, LibraryTrack, LobbyMode } from './models';

export type BaseMode = 'CLASSIC' | 'BUZZ' | 'ORIGIN' | 'MID_CLIP';

export interface GameModeDefinition {
  id: BaseMode;
  label: string;
  description: string;
}

export const GAME_MODES: GameModeDefinition[] = [
  {
    id: 'CLASSIC',
    label: 'Adivina la canción',
    description: 'Escucha el inicio y adivina el tema.',
  },
  {
    id: 'BUZZ',
    label: 'PULSA y adivina',
    description: 'Pulsa antes de responder.',
  },
  {
    id: 'ORIGIN',
    label: 'Adivina el origen',
    description: 'Anime, artista o película según la biblioteca.',
  },
  {
    id: 'MID_CLIP',
    label: 'Clip en mitad',
    description: 'Repite un fragmento mientras dura la ronda.',
  },
];

export const resolveBaseMode = (mode: LobbyMode): BaseMode => {
  switch (mode) {
    case 'BUZZ':
      return 'BUZZ';
    case 'ORIGIN':
      return 'ORIGIN';
    case 'MID_CLIP':
      return 'MID_CLIP';
    case 'WRITE':
      return 'CLASSIC';
    case 'ONE_SECOND':
      return 'MID_CLIP';
    case 'CLASSIC':
    default:
      return 'CLASSIC';
  }
};

export const requiresBuzz = (mode: LobbyMode) => resolveBaseMode(mode) === 'BUZZ';

export const isMidClipMode = (mode: LobbyMode) => resolveBaseMode(mode) === 'MID_CLIP';

export const formatSongGuessLabel = (track: LibraryTrack) => {
  const artist = track.artist?.trim();
  return artist ? `${artist} - ${track.title}` : track.title;
};

export const resolveOriginLabel = (track: LibraryTrack, library: LibraryId) => {
  if (library === LibraryId.ROCK) {
    return track.artist;
  }
  return track.origin ?? track.title;
};

export const formatGuessLabel = (track: LibraryTrack, mode: LobbyMode, library: LibraryId) => {
  if (resolveBaseMode(mode) === 'ORIGIN') {
    return resolveOriginLabel(track, library);
  }
  return formatSongGuessLabel(track);
};

export const getModeLabel = (mode: LobbyMode) => {
  const resolved = resolveBaseMode(mode);
  return GAME_MODES.find((entry) => entry.id === resolved)?.label ?? mode;
};
