export type NicknameParts = {
  adjective?: string;
  noun?: string;
  modifier?: string;
  proper?: string;
  title?: string;
};

type TemplatePart = keyof NicknameParts;

type NicknameTemplate = {
  parts: TemplatePart[];
  weight: number;
};

type NicknameOptions = {
  previousNickname?: string | null;
  previousParts?: NicknameParts | null;
  minLength?: number;
  maxLength?: number;
};

export type LobbyNameParts = {
  place?: string;
  theme?: string;
  descriptor?: string;
  adjective?: string;
};

type LobbyTemplatePart = keyof LobbyNameParts;

type LobbyTemplate = {
  parts: LobbyTemplatePart[];
  weight: number;
};

type LobbyNameOptions = {
  previousName?: string | null;
  previousParts?: LobbyNameParts | null;
  minLength?: number;
  maxLength?: number;
};

const ADJECTIVES = [
  'ágil',
  'alto',
  'bajo',
  'bravo',
  'claro',
  'cósmico',
  'eléctrico',
  'dulce',
  'fantástico',
  'fiero',
  'fresco',
  'funky',
  'heroico',
  'luminoso',
  'magnético',
  'misterioso',
  'rápido',
  'rítmico',
  'salvaje',
  'solar',
  'urbano',
  'vivo',
];

const NOUNS = [
  'beat',
  'cometa',
  'eco',
  'estrella',
  'guitarra',
  'fuego',
  'jaguar',
  'lince',
  'lobo',
  'luna',
  'melodía',
  'neón',
  'puma',
  'rosa',
  'sirena',
  'sol',
  'satélite',
  'rayo',
  'ritmo',
  'tango',
  'tigre',
  'trueno',
  'vinilo',
  'viento',
  'zorro',
];

const NOUN_GENDER: Record<string, 'f' | 'm'> = {
  cometa: 'm',
  eco: 'm',
  estrella: 'f',
  guitarra: 'f',
  fuego: 'm',
  jaguar: 'm',
  lince: 'm',
  lobo: 'm',
  luna: 'f',
  melodía: 'f',
  neón: 'm',
  puma: 'm',
  rayo: 'm',
  ritmo: 'm',
  rosa: 'f',
  satélite: 'm',
  sirena: 'f',
  sol: 'm',
  tango: 'm',
  tigre: 'm',
  trueno: 'm',
  vinilo: 'm',
  viento: 'm',
  zorro: 'm',
};

const PROPER_NAMES = [
  'alma',
  'bruno',
  'ciro',
  'hugo',
  'iris',
  'lola',
  'mara',
  'milo',
  'nico',
  'nora',
  'noa',
  'sara',
  'teo',
  'vera',
];

const MODIFIERS = [
  'de Neón',
  'del Ritmo',
  'de Vinilo',
  'del Norte',
  'de Medianoche',
  'de Garaje',
  'de Acero',
  'del Beat',
  'de Bronce',
  'de Fuego',
  'de Pop',
  'de Jazz',
];

const TITLES = ['Capitán', 'Comandante', 'Maestro', 'Sargento'];

const LOBBY_PLACES = [
  'Sala',
  'Club',
  'Guarida',
  'Estudio',
  'Rincón',
  'Refugio',
  'Cabina',
  'Hangar',
  'Escenario',
  'Cueva',
];

const LOBBY_THEMES = [
  'Neón',
  'Vinilo',
  'Ritmo',
  'Groove',
  'Jazz',
  'Fuego',
  'Luna',
  'Cometa',
  'Bajo',
  'Batería',
  'Sonido',
  'Bruma',
  'Tigre',
  'Lobo',
];

const LOBBY_DESCRIPTORS = [
  'del Ritmo',
  'de Vinilo',
  'del Groove',
  'de la Noche',
  'del Beat',
  'de Jazz',
  'del Norte',
  'de Garaje',
  'de Medianoche',
  'de Acero',
  'de Fuego',
  'del Sonido',
  'de la Selva',
];

const LOBBY_ADJECTIVES = [
  'secreta',
  'nocturna',
  'eléctrica',
  'sonora',
  'retro',
  'legendaria',
  'salvaje',
  'brillante',
  'oscura',
];

const LOBBY_PLACE_GENDER: Record<string, 'f' | 'm'> = {
  Sala: 'f',
  Club: 'm',
  Guarida: 'f',
  Estudio: 'm',
  Rincón: 'm',
  Refugio: 'm',
  Cabina: 'f',
  Hangar: 'm',
  Escenario: 'm',
  Cueva: 'f',
};

const TEMPLATES: NicknameTemplate[] = [
  { parts: ['adjective', 'noun'], weight: 40 },
  { parts: ['noun', 'modifier'], weight: 20 },
  { parts: ['proper', 'noun'], weight: 15 },
  { parts: ['proper', 'modifier'], weight: 10 },
  { parts: ['noun', 'noun'], weight: 10 },
  { parts: ['title', 'proper'], weight: 5 },
];

const LOBBY_TEMPLATES: LobbyTemplate[] = [
  { parts: ['place', 'descriptor'], weight: 45 },
  { parts: ['place', 'theme'], weight: 30 },
  { parts: ['place', 'adjective'], weight: 15 },
  { parts: ['place', 'theme', 'descriptor'], weight: 10 },
];

const DEFAULT_MIN_LENGTH = 10;
const DEFAULT_MAX_LENGTH = 15;
const MAX_ATTEMPTS = 120;
const LOBBY_DEFAULT_MIN_LENGTH = 10;
const LOBBY_DEFAULT_MAX_LENGTH = 18;

const PART_SOURCES: Record<TemplatePart, string[]> = {
  adjective: ADJECTIVES,
  noun: NOUNS,
  modifier: MODIFIERS,
  proper: PROPER_NAMES,
  title: TITLES,
};

const LOBBY_PART_SOURCES: Record<LobbyTemplatePart, string[]> = {
  place: LOBBY_PLACES,
  theme: LOBBY_THEMES,
  descriptor: LOBBY_DESCRIPTORS,
  adjective: LOBBY_ADJECTIVES,
};

export type NicknameGenerator = {
  next: () => string;
};

export function createNicknameGenerator(
  minLength = DEFAULT_MIN_LENGTH,
  maxLength = DEFAULT_MAX_LENGTH,
) {
  let lastNickname: string | null = null;
  let lastParts: NicknameParts | null = null;

  return {
    next: () => {
      const { nickname, parts } = generateRandomNickname({
        previousNickname: lastNickname,
        previousParts: lastParts,
        minLength,
        maxLength,
      });
      lastNickname = nickname;
      lastParts = { ...(lastParts ?? {}), ...parts };
      return nickname;
    },
  };
}

export type LobbyNameGenerator = {
  next: () => string;
};

export function createLobbyNameGenerator(
  minLength = LOBBY_DEFAULT_MIN_LENGTH,
  maxLength = LOBBY_DEFAULT_MAX_LENGTH,
) {
  let lastName: string | null = null;
  let lastParts: LobbyNameParts | null = null;

  return {
    next: () => {
      const { name, parts } = generateRandomLobbyName({
        previousName: lastName,
        previousParts: lastParts,
        minLength,
        maxLength,
      });
      lastName = name;
      lastParts = { ...(lastParts ?? {}), ...parts };
      return name;
    },
  };
}

function generateRandomNickname(options: NicknameOptions = {}) {
  const minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const previousParts = options.previousParts ?? null;
  const previousNickname = options.previousNickname ?? null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const template = pickWeightedTemplate(TEMPLATES);
    const parts: NicknameParts = {};
    const usedWords = new Set<string>();
    for (const partName of template.parts) {
      const pool = PART_SOURCES[partName];
      const previousValue = previousParts?.[partName];
      const avoidValues = [previousValue, ...usedWords].filter(Boolean) as string[];
      const value = pickDifferent(pool, avoidValues);
      parts[partName] = value;
      usedWords.add(value);
    }

    const nickname = formatNickname(template.parts, parts);
    if (!nickname) {
      continue;
    }
    if (nickname.length < minLength || nickname.length > maxLength) {
      continue;
    }
    if (previousNickname && nickname === previousNickname) {
      continue;
    }
    return { nickname, parts };
  }

  const fallback = findFallbackNickname(minLength, maxLength);
  return { nickname: fallback || 'Jugador', parts: {} };
}

function generateRandomLobbyName(options: LobbyNameOptions = {}) {
  const minLength = options.minLength ?? LOBBY_DEFAULT_MIN_LENGTH;
  const maxLength = options.maxLength ?? LOBBY_DEFAULT_MAX_LENGTH;
  const previousParts = options.previousParts ?? null;
  const previousName = options.previousName ?? null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const template = pickWeightedTemplate(LOBBY_TEMPLATES);
    const parts: LobbyNameParts = {};
    const words: string[] = [];
    const usedWords = new Set<string>();
    for (const partName of template.parts) {
      const pool = LOBBY_PART_SOURCES[partName];
      const previousValue = previousParts?.[partName];
      const avoidValues = [previousValue, ...usedWords].filter(Boolean) as string[];
      const value = pickDifferent(pool, avoidValues);
      parts[partName] = value;
      words.push(formatLobbyWord(value, partName));
      usedWords.add(value);
    }

    const name = words.join(' ').trim();
    if (!name) {
      continue;
    }
    if (hasRedundantLobbyParts(parts)) {
      continue;
    }
    if (name.length < minLength || name.length > maxLength) {
      continue;
    }
    if (previousName && name === previousName) {
      continue;
    }
    return { name, parts };
  }

  const fallback = findFallbackLobbyName(minLength, maxLength);
  return { name: fallback || 'Sala', parts: {} };
}

function hasRedundantLobbyParts(parts: LobbyNameParts) {
  const theme = parts.theme;
  const descriptor = parts.descriptor;
  if (theme && descriptor) {
    const normalizedTheme = normalizeWord(theme);
    const normalizedDescriptor = normalizeWord(descriptor);
    if (normalizedDescriptor.includes(normalizedTheme)) {
      return true;
    }
  }
  return false;
}

function normalizeWord(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pickWeightedTemplate<T extends { weight: number }>(templates: T[]) {
  const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  const target = Math.random() * totalWeight;
  let cumulative = 0;
  for (const template of templates) {
    cumulative += template.weight;
    if (target <= cumulative) {
      return template;
    }
  }
  return templates[0];
}

function pickDifferent(pool: string[], avoidValues: string[] = []) {
  if (!pool.length) {
    return '';
  }
  if (pool.length === 1) {
    return pool[0];
  }
  if (!avoidValues.length) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let value = avoidValues[0];
  while (avoidValues.includes(value)) {
    value = pool[Math.floor(Math.random() * pool.length)];
  }
  return value;
}

function formatNickname(order: TemplatePart[], parts: NicknameParts) {
  if (order.length === 2 && order[0] === 'adjective' && order[1] === 'noun') {
    const adjective = parts.adjective;
    const noun = parts.noun;
    if (!adjective || !noun) {
      return '';
    }
    return formatAdjectiveNoun(adjective, noun);
  }
  const words: string[] = [];
  for (const partName of order) {
    const rawValue = parts[partName];
    if (!rawValue) {
      return '';
    }
    words.push(formatWord(rawValue, partName));
  }
  return words.join(' ').trim();
}

function formatWord(value: string, partName: TemplatePart) {
  if (partName === 'modifier' || partName === 'title') {
    return value;
  }
  return capitalizeWord(value);
}

function formatAdjectiveNoun(adjective: string, noun: string) {
  const resolvedAdjective = inflectAdjectiveForNoun(adjective, noun);
  return `${capitalizeWord(noun)} ${capitalizeWord(resolvedAdjective)}`.trim();
}

function inflectAdjectiveForNoun(adjective: string, noun: string) {
  if (!isFeminineNoun(noun)) {
    return adjective;
  }
  if (adjective.endsWith('o')) {
    return `${adjective.slice(0, -1)}a`;
  }
  return adjective;
}

function isFeminineNoun(noun: string) {
  return NOUN_GENDER[noun] === 'f';
}

function capitalizeWord(word: string) {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function findFallbackNickname(minLength: number, maxLength: number) {
  for (const adjective of ADJECTIVES) {
    for (const noun of NOUNS) {
      const nickname = formatNickname(['adjective', 'noun'], { adjective, noun });
      if (nickname.length >= minLength && nickname.length <= maxLength) {
        return nickname;
      }
    }
  }
  return '';
}

function formatLobbyName(order: LobbyTemplatePart[], parts: LobbyNameParts) {
  if (order.length === 2 && order[0] === 'place' && order[1] === 'adjective') {
    const place = parts.place;
    const adjective = parts.adjective;
    if (!place || !adjective) {
      return '';
    }
    return formatPlaceAdjective(place, adjective);
  }
  const words: string[] = [];
  for (const partName of order) {
    const rawValue = parts[partName];
    if (!rawValue) {
      return '';
    }
    words.push(formatLobbyWord(rawValue, partName));
  }
  return words.join(' ').trim();
}

function formatLobbyWord(value: string, partName: LobbyTemplatePart) {
  if (partName === 'descriptor') {
    return value;
  }
  return capitalizeWord(value);
}

function formatPlaceAdjective(place: string, adjective: string) {
  const resolvedAdjective = inflectAdjectiveForPlace(adjective, place);
  return `${capitalizeWord(place)} ${capitalizeWord(resolvedAdjective)}`.trim();
}

function inflectAdjectiveForPlace(adjective: string, place: string) {
  const gender = LOBBY_PLACE_GENDER[place];
  if (!gender) {
    return adjective;
  }
  if (gender === 'f' && adjective.endsWith('o')) {
    return `${adjective.slice(0, -1)}a`;
  }
  if (gender === 'm' && adjective.endsWith('a')) {
    return `${adjective.slice(0, -1)}o`;
  }
  return adjective;
}

function findFallbackLobbyName(minLength: number, maxLength: number) {
  for (const place of LOBBY_PLACES) {
    for (const descriptor of LOBBY_DESCRIPTORS) {
      const name = formatLobbyName(['place', 'descriptor'], { place, descriptor });
      if (name.length >= minLength && name.length <= maxLength) {
        return name;
      }
    }
  }
  return '';
}
