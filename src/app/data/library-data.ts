import { LibraryId, LibraryInfo, LibraryTrack } from '../models';

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

const tracks: Array<LibraryTrack & { libraryId: LibraryId }> = [
  {
    id: 'anime-01',
    libraryId: LibraryId.ANIME,
    duration: 30,
    title: 'Gurenge',
    artist: 'LiSA',
  },
  {
    id: 'anime-02',
    libraryId: LibraryId.ANIME,
    duration: 30,
    title: 'Unravel',
    artist: 'TK',
  },
  {
    id: 'ost-01',
    libraryId: LibraryId.OST,
    duration: 30,
    title: 'Time',
    artist: 'Hans Zimmer',
  },
  {
    id: 'ost-02',
    libraryId: LibraryId.OST,
    duration: 30,
    title: "He's a Pirate",
    artist: 'Klaus Badelt',
  },
  {
    id: 'rock-01',
    libraryId: LibraryId.ROCK,
    duration: 30,
    title: 'Mr. Brightside',
    artist: 'The Killers',
  },
  {
    id: 'rock-02',
    libraryId: LibraryId.ROCK,
    duration: 30,
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
  },
  {
    id: 'anime-03',
    libraryId: LibraryId.ANIME,
    duration: 30,
    title: 'Tank!',
    artist: 'The Seatbelts',
  },
  {
    id: 'anime-04',
    libraryId: LibraryId.ANIME,
    duration: 30,
    title: 'Crossing Field',
    artist: 'LiSA',
  },
  {
    id: 'ost-03',
    libraryId: LibraryId.OST,
    duration: 30,
    title: 'The Imperial March',
    artist: 'John Williams',
  },
  {
    id: 'ost-04',
    libraryId: LibraryId.OST,
    duration: 30,
    title: 'Now We Are Free',
    artist: 'Hans Zimmer & Lisa Gerrard',
  },
  {
    id: 'rock-03',
    libraryId: LibraryId.ROCK,
    duration: 30,
    title: 'Take Me Out',
    artist: 'Franz Ferdinand',
  },
  {
    id: 'rock-04',
    libraryId: LibraryId.ROCK,
    duration: 30,
    title: 'Do I Wanna Know?',
    artist: 'Arctic Monkeys',
  },
];

const tracksByLibrary: Record<LibraryId, LibraryTrack[]> = tracks.reduce((acc, track) => {
  const { libraryId, ...trackInfo } = track;
  if (!acc[libraryId]) {
    acc[libraryId] = [];
  }
  acc[libraryId].push(trackInfo);
  return acc;
}, {} as Record<LibraryId, LibraryTrack[]>);

export const libraryCatalog: LibraryInfo[] = (
  Object.entries(libraries) as Array<[LibraryId, LibraryMeta]>
).map(([id, meta]) => ({
  id,
  ...meta,
  trackCount: tracksByLibrary[id]?.length ?? 0,
}));

export const getLibraryTracks = (libraryId: LibraryId): LibraryTrack[] =>
  tracksByLibrary[libraryId] ?? [];
