# Documento de diseño — MVP: **Adivina la canción** (Bun + Angular)

## 1 — Resumen rápido (objetivo)

Crear un prototipo multijugador donde jugadores en un lobby escuchan clips de canciones y adivinan. Un jugador es _host_; el resto _guests_. Modo _buzzer_ (botón que pausa y permite responder), modo _escribir_ (respuestas sin pausar), y modo _1s_ (solo 1 segundo). Implementación con **Bun** (backend + websockets) y **Angular** (frontend). Backend sirve pistas mínimamente procesadas y coordina estado en tiempo real.

---

# 2 — Requisitos funcionales (MVP)

- Lobbies con username; host crea lobby y selecciona biblioteca (anime, OST, rock, etc.).
- Sala de espera: lista de jugadores, host puede empezar.
- Rondas: reproducir pista por cuenta atrás (configurable, p. ej. 30s por ronda).
- **Buzzer mode**: cualquier jugador puede pulsar botón “buzz” → música se pausa para todos; ese jugador tiene intento. Si falla, música se reanuda desde el punto pausado y ese jugador no puede volver a pulsar en esa ronda.
- **Write mode**: todos pueden escribir respuestas mientras suena; primera respuesta correcta gana.
- **1-second mode**: solo 1 segundo de la pista (o múltiples segundos seguidos según reglas).
- Botón _omitir_ (skip) que solo host o X jugadores pueden usar — define votos o host override.
- Puntuación: cuanto menos tiempo haya escuchado el que acierta, más puntos.
- Historial de partidas (básico) y ranking en la sesión.
- Protección básica anti-spoiler (no enviar metadatos inmediatos al cliente).

---

# 3 — Reglas y mecánicas concretas (MVP)

### Rondas

- Cada ronda:

  1. Se elige una pista aleatoria de la biblioteca seleccionada.
  2. Servidor envía meta: `{trackId, clipLength, startAtServerTime}` sin título/autor.
  3. Todos los clientes cargan la URL ~ready; servidor emite `PLAY` con timestamp de inicio sincronizado.

### Buzzer mode

- Evento cliente → servidor: `BUZZ` (incluye userId, lobbyId, clientTimestamp).
- Servidor valida primer buzz y emite `PAUSE` (con offset exacto).
- Cliente buzzer ve UI para escribir su respuesta con tiempo límite (ej. 10s).
- Si respuesta correcta → emitir `ROUND_END` con puntos; si incorrecta → `RESUME` para todos desde offset pausado; marcamos el jugador como `lockedForRound = true`.

### Write mode

- Clientes envían `GUESS` por websocket (texto).
- Servidor valida la primera correcta y emite `ROUND_END`.

### Skip

- `SKIP_REQUEST` → si host, skip inmediato; si votado: recolectar votos >50% → `SKIP`.

### Puntuación (propuesta)

- Parámetros: `maxPointsPerRound = 1000`, `roundDurationSeconds = R` (p. ej. 30s).
- Si jugador acierta al tiempo `t` (segundos transcurridos desde inicio de reproducción), puntos:

  ```
  points = floor(maxPointsPerRound * (1 - t / R))
  ```

  Asegurar mínimo 50 puntos si acierta al final (evitar 0).

- En buzzer mode, `t` es el offset en el que pulsó el buzzer (más rápido → más puntos).

---

# 4 — Flujo de UI (pantallas principales)

1. **Landing / Login**: elegir username (no password MVP).
2. **Crear / Unirse lobby**: seleccionar biblioteca, número máximo de jugadores, modo.
3. **Lobby**: lista jugadores, host controls (start, next, skip, config).
4. **In-game**:

   - Panel central: reproductor visual (waveform simple o progress bar), cuenta atrás de ronda.
   - Botones: BUZZ (si modo buzzer), SKIP, escribir respuesta (modo write).
   - Lista de jugadores con estado (locked, score).

5. **Round result**: mostrar quien acertó, pista revelada (title/artist), puntuaciones.
6. **Match end / leaderboard**.

---

# 5 — Arquitectura general

### Componentes

- **Backend (Bun)**

  - HTTP API (lobbies, auth mínima, track metadata).
  - WebSocket server (estado en tiempo real, eventos de juego).
  - Worker para preprocesar pistas (clipar, normalizar volumen).

- **Storage**

  - Tracks: almacenamiento de archivos (S3-compatible) + CDN (CloudFront/Cloudflare).
  - Metadata / persistencia: PostgreSQL (lobbies, users, games, rounds).
  - Sesiones y estado volátil: Redis (locks, ephemeral lobby state, rate limiting).

- **Frontend (Angular)**

  - Single Page App, conexión WebSocket persistente, Audio vía `HTMLAudioElement`.

- **DevOps / Deploy**

  - Containerizar Bun + Angular. Postgres + Redis gestionados (cloud). CDN para archivos. TLS en front+ws (nginx o proxy de plataforma).
  - CI: GitHub Actions -> build bun image + build Angular -> deploy.

### Escalado y sincronización

- Mantener un único _lobby leader_ en Redis para coordinación; para escala horizontal usar sticky sessions o pub/sub (Redis) para propagar eventos entre Bun instances.
- Tiempo maestro: servidor autoritario envía `serverTime` y `startAt` (ISO timestamp) para sincronizar reproducción cliente.

---

# 6 — API y eventos WebSocket (especificación)

### HTTP REST (ejemplos)

- `POST /api/lobbies` -> crea lobby `{id, hostId, mode, library, maxPlayers}`
- `POST /api/lobbies/:id/join` -> `{username}` -> `{playerId, lobbyState}`

### WebSocket events (JSON)

- **Cliente → Servidor**

  - `JOIN_LOBBY` `{lobbyId, playerId, username}`
  - `START_GAME` `{lobbyId}`
  - `BUZZ` `{lobbyId, playerId, clientTime}`
  - `GUESS` `{lobbyId, playerId, guessText}`
  - `SKIP_REQUEST` `{lobbyId, playerId}`
  - `PING` `{ts}`

- **Servidor → Cliente**

  - `LOBBY_UPDATE` `{players[], hostId, settings}`
  - `ROUND_START` `{trackId, clipUrl, clipDuration, startAtServerTs}`
  - `PLAY` `{startAtServerTs}` (sincroniza reproducción)
  - `PAUSE` `{offsetSeconds, byPlayerId?}`
  - `BUZZ_ACCEPTED` `{playerId, offsetSeconds}`
  - `GUESS_RESULT` `{playerId, correct, revealedTitle?, pointsAwarded}`
  - `ROUND_END` `{winner?, revealedTrackMeta, leaderboardSnapshot}`
  - `ERROR` `{code, message}`
  - `PONG` `{ts}`

---

# 7 — Modelos de datos (TypeScript interfaces / SQL)

### TypeScript (ejemplos)

```ts
interface Player {
  id: string;
  username: string;
  score: number;
  lockedForRound: boolean;
  isHost?: boolean;
}

interface Lobby {
  id: string;
  hostId: string;
  mode: "BUZZ" | "WRITE" | "ONE_SECOND";
  library: string;
  roundDuration: number;
  players: Player[];
  state: "WAITING" | "IN_GAME" | "FINISHED";
}

interface Track {
  id: string;
  library: string;
  fileUrl: string; // CDN URL for clip
  duration: number; // seconds
  title?: string; // stored but not revealed until round end
  artist?: string;
}
```

### SQL tables (simplified)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE lobbies (
  id uuid PRIMARY KEY,
  host_id uuid REFERENCES users(id),
  mode text,
  library text,
  round_duration int,
  max_players int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE lobby_players (
  lobby_id uuid REFERENCES lobbies(id),
  user_id uuid REFERENCES users(id),
  score int DEFAULT 0,
  locked boolean DEFAULT false,
  PRIMARY KEY (lobby_id, user_id)
);

CREATE TABLE tracks (
  id uuid PRIMARY KEY,
  library text,
  file_url text,
  duration int,
  title text,
  artist text
);

CREATE TABLE rounds (
  id uuid PRIMARY KEY,
  lobby_id uuid REFERENCES lobbies(id),
  track_id uuid REFERENCES tracks(id),
  start_ts timestamptz,
  end_ts timestamptz,
  winner_user_id uuid REFERENCES users(id),
  winner_points int
);
```

---

# 8 — Sincronización audio — técnica recomendada (clave)

- No confiar en cliente clock; usar servidor como referencia:

  - Cliente solicita `ROUND_START`, descarga el clip (preload), y el servidor envía `PLAY` con `startAtServerTs` (ISO epoch ms).
  - Cliente calcula `delta = serverTsNow - Date.now()` (al primer handshake usar `PING/PONG` para medir round-trip y clock offset) y programa `audio.play()` para `startAtClient = startAtServerTs - offset`.

- Para pausas: servidor envía `PAUSE` con `offsetSeconds` y `PAUSE_BY` id; clientes `audio.pause()` y store offset.
- Cuando `RESUME` → servidor envía `PLAY` con new `startAtServerTs` or `seekTo` offset value.
- Para evitar que un jugador haga seek local para saber título: servir clips sin metadata y usar short clips (MVP). Validar respuestas en servidor.

---

# 9 — Manejo de audio y tracks

- **Formato**: mp3/aac, bitrate moderado (96–128kbps).
- **Almacenamiento**:

  - Producción: pista completa en S3, clips generados y subidos como archivos separados (server-side clipper, ffmpeg).
  - MVP: subir clips ya recortados al storage.

- **CDN**: servir clips via CDN público para reducir latencia.
- **Preload**: usar `audio.preload = "auto"` y `audio.crossOrigin = "anonymous"`.

---

# 10 — Anti-cheat y consideraciones legales

- No enviar título/artist hasta revelar en `ROUND_END`.
- No permitir acceso directo al track mapping desde cliente (track IDs no predecibles).
- Para música con copyright: usar librerías libres o clips con licencias, o usar música propia/licencias para prototipo. (MVP: usar música sin copyright o clips generados).
- Rate-limit guesses per player per round; validar on-server; filtrar caracteres y normalizar strings para comparación.

---

# 11 — Implementación: estructura de proyecto (sugerida)

```
/server/                # Bun project
  src/
    index.ts            # HTTP + WS bootstrap
    game/
      lobbyManager.ts
      gameEngine.ts
      audioProcessor.ts
    controllers/
      lobbies.ts
    db/
      pg.ts
    workers/
      clipper.ts
  Dockerfile

/client/                # Angular app
  src/
    app/
      services/
        ws.service.ts
        api.service.ts
        audio.service.ts
      components/
        lobby/
        game/
        leaderboard/
  angular.json
  Dockerfile (build output served statically)
```

---

# 12 — Ejemplos de handlers (pseudocódigo Bun TS)

```ts
// on 'BUZZ'
ws.on("message", async (msg) => {
  const { type, payload } = JSON.parse(msg);
  if (type === "BUZZ") {
    const accepted = gameEngine.tryBuzz(payload.lobbyId, payload.playerId, payload.clientTime);
    if (accepted) {
      // compute offset and emit PAUSE with offset to all clients in lobby
      broadcastToLobby(lobbyId, { type: "PAUSE", payload: { offsetSeconds } });
      sendTo(wsOfPlayer, { type: "BUZZ_ACCEPTED", payload: { offsetSeconds } });
    } else {
      sendTo(wsOfPlayer, { type: "ERROR", payload: { message: "Already buzzed or too late" } });
    }
  }
});
```

---

# 13 — Deploy / Infra sugerida para MVP

- **Local / early dev**: Docker Compose (Bun container, Postgres, Redis).
- **Small production MVP**:

  - Backend: Docker container desplegado en Fly.io / Render / Railway (soporta websockets), o VPS (Docker + nginx).
  - Static Angular: CDN / Netlify / Vercel (serve static + TLS).
  - Tracks: S3 (DigitalOcean Spaces / AWS S3) + CDN (Cloudflare / CloudFront).
  - Database: managed Postgres (Neon / Supabase / Heroku Postgres).
  - Redis: managed Redis (Upstash / Redis Cloud) para pub/sub y estado.

- **TLS & domain**: usar platform-managed TLS (Vercel/Cloudflare) o nginx reverse proxy.
- **Scaling**:

  - Mantener estado del lobby en Redis para permitir múltiples instances; usar Redis Pub/Sub para propagar eventos entre Bun instances.
  - Si latencia websocket crítica, mantener sticky sessions por instance (menos recomendado).

---

# 14 — Plan de trabajo para Codex (tareas concretas)

1. Bootstrap repo: Bun + TypeScript starter + Angular app scaffold.
2. Implementar modelos DB y migraciones (Postgres).
3. Implementar HTTP APIs de lobby y librerías.
4. Implementar WebSocket server con eventos básicos y `lobbyManager` en memoria + persistente en Redis.
5. Implementar simple client Angular: join lobby, show players, start game.
6. Implement audio flow minimal: server envía `ROUND_START` con clipUrl; client preloads; server sends `PLAY` with startAt; clients play.
7. Implement buzzer flow: `BUZZ` → server `PAUSE` → allow guess → validate → `RESUME` o `ROUND_END`.
8. Add scoring and leaderboard UI.
9. Add clip processing (ffmpeg worker) + upload to storage (manual for MVP possible).
10. Tests end-to-end: 2 browsers join same lobby, buzzer behavior.

---

# 15 — Detalles útiles / decisiones técnicas rápidas

- WebSocket library: usar la implementación nativa de Bun (o `uWebSockets.js`) — Bun tiene soporte websocket sencillo.
- Tiempo y precisión: compensar latencia con ping/pong y `startAt` timestamps.
- Comparación de respuestas: normalizar strings (lowercase, strip diacritics, remove punctuation) y usar fuzzy match (levenshtein <= threshold) en servidor.
- Logging y observabilidad: usar Sentry/LogDNA y métricas básicas.
- Tests: integración manual + simple test harness que simule 3 sockets.

---

# 16 — Entregables para Codex

- Repo con `server/` y `client/`.
- README con scripts:

  - `dev:server`, `dev:client`, `start:docker-compose`, `deploy`.

- Scripts de DB (migrations).
- Playbook de cómo añadir nuevas bibliotecas de pistas (uploader + metadata CSV).
- Documento de contrato WS (JSON schema).

---

Si quieres, te doy ahora:

- 1. **Esqueleto de WebSocket event handler en Bun (TypeScript)** listo para copiar,
- 2. **Esqueleto de Angular service** (`ws.service.ts`) con manejo de sincronización y audio,
- 3. `docker-compose.yml` mínimo para dev (Bun + Postgres + Redis).

Dime cuál quieres que genere ya y te lo doy sin más rodeos.
