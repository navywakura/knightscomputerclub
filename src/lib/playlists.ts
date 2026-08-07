/** Playlists por zona — archivos en /public/reproductormp3/ */

export type Track = {
  id: string;
  title: string;
  artist: string;
  src: string;
};

export type PlaylistId = "home" | "ops" | "nexo";

export type Playlist = {
  id: PlaylistId;
  label: string;
  zone: string;
  tracks: Track[];
};

/** Solo lobby (ruta /) */
const HOME_DIR = "/reproductormp3/playlist_para_home";

/** Foro + donate exclusivamente */
const OPS_DIR = "/reproductormp3/playlist_para_forum_y_donate";

const LOBBY_TRACKS: Track[] = [
  {
    id: "elevator-bossa",
    title: "Elevator Bossa Nova",
    artist: "Bensound",
    src: `${HOME_DIR}/elevator-bossa-nova.mp3`,
  },
  {
    id: "airport-lounge",
    title: "Airport Lounge",
    artist: "Kevin MacLeod",
    src: `${HOME_DIR}/airport-lounge.mp3`,
  },
  {
    id: "local-forecast",
    title: "Local Forecast (Slower)",
    artist: "Kevin MacLeod",
    src: `${HOME_DIR}/local-forecast-slower.mp3`,
  },
  {
    id: "george-street",
    title: "George Street Shuffle",
    artist: "Kevin MacLeod",
    src: `${HOME_DIR}/george-street-shuffle.mp3`,
  },
  {
    id: "lucky-break",
    title: "Lucky Break",
    artist: "Bryan Teoh",
    src: `${HOME_DIR}/lucky-break.mp3`,
  },
];

const OPS_TRACKS: Track[] = [
  {
    id: "longnight",
    title: "LONGNIGHT",
    artist: "ops",
    src: `${OPS_DIR}/LONGNIGHT.m4a`,
  },
  {
    id: "spacetrip",
    title: "SPACETRIP",
    artist: "ops",
    src: `${OPS_DIR}/SPACETRIP.m4a`,
  },
];

/** Elevador / sala de espera / lobby — solo HOME */
export const HOME_PLAYLIST: Playlist = {
  id: "home",
  label: "LOBBY MUZAK",
  zone: "elevator · waiting room",
  tracks: LOBBY_TRACKS,
};

/**
 * Foro + donate — tracks de public/reproductormp3/playlist_para_forum_y_donate
 * + remezcla de lobby para más variedad (mismo nodo, más duración).
 */
export const OPS_PLAYLIST: Playlist = {
  id: "ops",
  label: "NODE SIGNAL",
  zone: "forum · donate · extended",
  tracks: [
    ...OPS_TRACKS,
    // extender con lounge (orden distinto = más “música” sin archivos nuevos)
    LOBBY_TRACKS[1], // Airport Lounge
    LOBBY_TRACKS[3], // George Street
    LOBBY_TRACKS[2], // Local Forecast
    LOBBY_TRACKS[0], // Elevator Bossa
    LOBBY_TRACKS[4], // Lucky Break
    OPS_TRACKS[0],
    OPS_TRACKS[1],
  ],
};

/** Nexo chat — señal wired + lounge nocturno */
export const NEXO_PLAYLIST: Playlist = {
  id: "nexo",
  label: "WIRED CHANNEL",
  zone: "nexo · realtime",
  tracks: [
    OPS_TRACKS[1], // SPACETRIP
    LOBBY_TRACKS[2],
    OPS_TRACKS[0], // LONGNIGHT
    LOBBY_TRACKS[1],
    LOBBY_TRACKS[4],
    LOBBY_TRACKS[3],
    LOBBY_TRACKS[0],
    OPS_TRACKS[1],
  ],
};

/** true si la ruta usa la playlist de forum/donate */
export function isOpsPath(pathname: string): boolean {
  const p = pathname || "/";
  return (
    p === "/donate" ||
    p.startsWith("/donate/") ||
    p === "/forum" ||
    p.startsWith("/forum/")
  );
}

export function isNexoPath(pathname: string): boolean {
  const p = pathname || "/";
  return p === "/nexo" || p.startsWith("/nexo/");
}

/** home → lobby; /nexo → wired; /forum y /donate → ops */
export function playlistForPath(pathname: string): Playlist {
  const p = pathname || "/";
  if (p === "/" || p === "") return HOME_PLAYLIST;
  if (isNexoPath(p)) return NEXO_PLAYLIST;
  if (isOpsPath(p)) return OPS_PLAYLIST;
  return OPS_PLAYLIST;
}
