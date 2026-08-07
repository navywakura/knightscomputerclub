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

const HOME_DIR = "/reproductormp3/playlist_para_home";
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

/** Foro + donate */
export const OPS_PLAYLIST: Playlist = {
  id: "ops",
  label: "NODE JAZZ",
  zone: "forum · donate",
  tracks: [
    {
      id: "longnight",
      title: "LONGNIGHT",
      artist: "playlist",
      src: `${OPS_DIR}/LONGNIGHT.m4a`,
    },
    {
      id: "spacetrip",
      title: "SPACETRIP",
      artist: "playlist",
      src: `${OPS_DIR}/SPACETRIP.m4a`,
    },
  ],
};

/** home → lobby; forum + donate → ops; resto → ops */
export function playlistForPath(pathname: string): Playlist {
  if (pathname === "/" || pathname === "") return HOME_PLAYLIST;
  if (pathname.startsWith("/forum") || pathname.startsWith("/donate")) {
    return OPS_PLAYLIST;
  }
  return OPS_PLAYLIST;
}
