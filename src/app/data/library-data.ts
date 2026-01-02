import { LibraryId, LibraryInfo, LibraryTrack } from '../models';
import { animeTracks } from './library-data/anime';
import { ostTracks } from './library-data/ost';
import { rockTracks } from './library-data/rock';

type LibraryMeta = {
  name: string;
  description: string;
};

const libraries: Record<LibraryId, LibraryMeta> = {
  [LibraryId.ANIME]: {
    name: 'Anime',
    description: 'Aperturas famosas para rounds rapidos.',
  },
  [LibraryId.OST]: {
    name: 'OST Cine',
    description: 'Bandas sonoras epicas y reconocibles.',
  },
  [LibraryId.ROCK]: {
    name: 'Rock',
    description: 'Riffs y estribillos con entradas potentes.',
  },
};

const tracksByLibrary: Record<LibraryId, LibraryTrack[]> = {
  [LibraryId.ANIME]: animeTracks,
  [LibraryId.OST]: ostTracks,
  [LibraryId.ROCK]: rockTracks,
};

export const libraryCatalog: LibraryInfo[] = (
  Object.entries(libraries) as Array<[LibraryId, LibraryMeta]>
).map(([id, meta]) => ({
  id,
  ...meta,
  trackCount: tracksByLibrary[id]?.length ?? 0,
}));

export const getLibraryTracks = (libraryId: LibraryId): LibraryTrack[] =>
  tracksByLibrary[libraryId] ?? [];
