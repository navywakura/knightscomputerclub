/** Playlists por zona — archivos en /public/reproductormp3/ */

export type Track = {
  id: string;
  title: string;
  artist: string;
  src: string;
};

export type PlaylistId = "home" | "ops";

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

/** Elevador / sala de espera / lobby — solo HOME */
export const HOME_PLAYLIST: Playlist = {
  id: "home",
  label: "LOBBY MUZAK",
  zone: "elevator · waiting room",
  tracks: [
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
  ],
};

/**
 * Foro + donate — tracks de public/reproductormp3/playlist_para_forum_y_donate
 * (AAC/M4A; no reutilizar tracks del lobby)
 */
export const OPS_PLAYLIST: Playlist = {
  id: "ops",
  label: "NODE SIGNAL",
  zone: "forum · donate · playlist_para_forum_y_donate",
  tracks: [
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
  ],
};

/** true si la ruta usa la playlist de forum/donate/nexo */
export function isOpsPath(pathname: string): boolean {
  const p = pathname || "/";
  return (
    p === "/donate" ||
    p.startsWith("/donate/") ||
    p === "/forum" ||
    p.startsWith("/forum/") ||
    p === "/nexo" ||
    p.startsWith("/nexo/")
  );
}

/** home → lobby; /forum y /donate → ops; resto (auth/admin) → ops */
export function playlistForPath(pathname: string): Playlist {
  const p = pathname || "/";
  if (p === "/" || p === "") return HOME_PLAYLIST;
  if (isOpsPath(p)) return OPS_PLAYLIST;
  // login / register / admin: misma señal del nodo (ops)
  return OPS_PLAYLIST;
}
