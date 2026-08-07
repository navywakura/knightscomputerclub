/** Playlists por zona — archivos en /public */

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
      src: "/homeplaylist/elevator-bossa-nova.mp3",
    },
    {
      id: "airport-lounge",
      title: "Airport Lounge",
      artist: "Kevin MacLeod",
      src: "/homeplaylist/airport-lounge.mp3",
    },
    {
      id: "local-forecast",
      title: "Local Forecast (Slower)",
      artist: "Kevin MacLeod",
      src: "/homeplaylist/local-forecast-slower.mp3",
    },
  ],
};

/** Foro + donate — jazz distinto, misma estética cyber del sitio */
export const OPS_PLAYLIST: Playlist = {
  id: "ops",
  label: "NODE JAZZ",
  zone: "forum · donate",
  tracks: [
    {
      id: "george-street",
      title: "George Street Shuffle",
      artist: "Kevin MacLeod",
      src: "/forumanddonateplaylist/george-street-shuffle.mp3",
    },
    {
      id: "lucky-break",
      title: "Lucky Break",
      artist: "Bryan Teoh",
      src: "/forumanddonateplaylist/lucky-break.mp3",
    },
  ],
};

/** home → lobby; forum + donate → ops; resto (auth/admin) → ops suave o home? use ops for non-home */
export function playlistForPath(pathname: string): Playlist {
  if (pathname === "/" || pathname === "") return HOME_PLAYLIST;
  if (
    pathname.startsWith("/forum") ||
    pathname.startsWith("/donate")
  ) {
    return OPS_PLAYLIST;
  }
  // login/register/admin: mantener jazz del nodo (no lobby)
  return OPS_PLAYLIST;
}
