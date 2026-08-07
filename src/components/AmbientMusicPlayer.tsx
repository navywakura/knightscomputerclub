"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { playlistForPath, type PlaylistId, type Track } from "@/lib/playlists";

const VOL_KEY = "kc_muzak_vol";
const MUTE_KEY = "kc_muzak_muted";

/**
 * Estado + Audio fuera de React: sobrevive a remounts y a cambios de ruta
 * (forum ↔ donate no reinician la canción).
 */
type SharedMuzak = {
  audio: HTMLAudioElement | null;
  playlistId: PlaylistId | null;
  index: number;
  wasPlaying: boolean;
  volume: number;
  muted: boolean;
};

const shared: SharedMuzak = {
  audio: null,
  playlistId: null,
  index: 0,
  wasPlaying: false,
  volume: 0.35,
  muted: false,
};

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!shared.audio) {
    const a = new Audio();
    a.preload = "metadata";
    a.volume = shared.muted ? 0 : shared.volume;
    a.muted = shared.muted;
    shared.audio = a;
  }
  return shared.audio;
}

function loadTrack(a: HTMLAudioElement, src: string, resume: boolean) {
  const current = a.getAttribute("data-src");
  if (current === src) {
    if (resume && a.paused) {
      a.play().catch(() => {
        shared.wasPlaying = false;
      });
    }
    return;
  }
  const t = a.currentTime;
  a.setAttribute("data-src", src);
  a.src = src;
  a.load();
  // solo resetear posición si cambió de archivo
  if (current) {
    a.currentTime = 0;
  } else if (t > 0) {
    // no-op: nuevo elemento
  }
  if (resume) {
    a.play()
      .then(() => {
        shared.wasPlaying = true;
      })
      .catch(() => {
        shared.wasPlaying = false;
      });
  }
}

/**
 * Mini reproductor global.
 * HOME (/) → playlist_para_home
 * resto (forum/donate/auth) → playlist_para_forum_y_donate
 * Misma zona = misma playlist = audio continuo al navegar.
 */
export default function AmbientMusicPlayer() {
  const path = usePathname() || "/";
  const playlist = useMemo(() => playlistForPath(path), [path]);

  const [index, setIndex] = useState(shared.index);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(shared.muted);
  const [volume, setVolume] = useState(shared.volume);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const safeIndex = playlist.tracks.length
    ? index % playlist.tracks.length
    : 0;
  const track: Track | undefined = playlist.tracks[safeIndex];

  // zona body class (solo home cambia estética)
  useEffect(() => {
    const isHome = path === "/" || path === "";
    document.body.classList.add(isHome ? "zone-home" : "zone-ops");
    document.body.classList.remove(isHome ? "zone-ops" : "zone-home");
    // no limpiar en unmount por cambio de ruta: el cleanup
    // entre navigations apagaba clases y forzaba reflow innecesario
  }, [path]);

  // volume / mute desde storage (una vez)
  useEffect(() => {
    try {
      const v = localStorage.getItem(VOL_KEY);
      if (v != null) {
        const n = Math.min(1, Math.max(0, Number(v)));
        shared.volume = n;
        setVolume(n);
      }
      const m = localStorage.getItem(MUTE_KEY);
      if (m === "1") {
        shared.muted = true;
        setMuted(true);
      }
    } catch {
      /* ignore */
    }
    const a = getAudio();
    if (a) {
      a.volume = shared.muted ? 0 : shared.volume;
      a.muted = shared.muted;
      setPlaying(!a.paused && !a.ended);
      setProgress(a.currentTime || 0);
      setDuration(a.duration || 0);
      // rehidratar índice si ya había playlist
      if (shared.playlistId === playlist.id) {
        setIndex(shared.index);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = getAudio();
    if (!a) return;
    shared.volume = volume;
    shared.muted = muted;
    a.volume = muted ? 0 : volume;
    a.muted = muted;
  }, [volume, muted]);

  // listeners del audio singleton (una vez)
  useEffect(() => {
    const a = getAudio();
    if (!a) return;

    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => {
      shared.wasPlaying = true;
      setPlaying(true);
    };
    const onPause = () => {
      // no marcar wasPlaying=false aquí: un load() dispara pause
      setPlaying(false);
    };
    const onEnded = () => {
      shared.wasPlaying = true;
      setIndex((i) => {
        const len = Math.max(
          (playlistForPath(
            typeof window !== "undefined" ? window.location.pathname : "/"
          ).tracks.length || 1),
          1
        );
        const next = (i + 1) % len;
        shared.index = next;
        return next;
      });
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  // solo cambiar audio al cambiar de ZONA (home ↔ ops), no entre subpáginas
  useEffect(() => {
    const a = getAudio();
    if (!a) return;

    if (shared.playlistId === playlist.id) {
      // misma playlist: no tocar src; solo sincronizar UI
      setIndex(shared.index);
      setPlaying(!a.paused && !a.ended);
      return;
    }

    // zona nueva → reiniciar en track 0 de la nueva playlist
    const keep = shared.wasPlaying || !a.paused;
    shared.playlistId = playlist.id;
    shared.index = 0;
    setIndex(0);
    setProgress(0);
    setDuration(0);

    const first = playlist.tracks[0];
    if (!first) {
      a.pause();
      setPlaying(false);
      return;
    }

    loadTrack(a, first.src, keep);
    setPlaying(keep);
  }, [playlist.id, playlist]);

  // cambio de track (next/prev/list) dentro de la misma playlist
  useEffect(() => {
    const a = getAudio();
    if (!a || !track) return;
    if (shared.playlistId !== playlist.id) return;

    shared.index = safeIndex;
    const resume = shared.wasPlaying || !a.paused || playing;
    loadTrack(a, track.src, resume);
  }, [safeIndex, track, playlist.id, playing]);

  const next = useCallback(() => {
    shared.wasPlaying = true;
    setIndex((i) => {
      const n = (i + 1) % Math.max(playlist.tracks.length, 1);
      shared.index = n;
      return n;
    });
  }, [playlist.tracks.length]);

  const prev = useCallback(() => {
    shared.wasPlaying = true;
    setIndex((i) => {
      const n =
        i <= 0 ? Math.max(playlist.tracks.length - 1, 0) : i - 1;
      shared.index = n;
      return n;
    });
  }, [playlist.tracks.length]);

  async function toggle() {
    const a = getAudio();
    if (!a) return;
    if (!a.paused) {
      a.pause();
      shared.wasPlaying = false;
      setPlaying(false);
      return;
    }
    try {
      if (!a.getAttribute("data-src") && track) {
        loadTrack(a, track.src, false);
      }
      await a.play();
      shared.wasPlaying = true;
      setPlaying(true);
    } catch {
      shared.wasPlaying = false;
      setPlaying(false);
    }
  }

  function onVol(v: number) {
    setVolume(v);
    shared.volume = v;
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* */
    }
    if (v > 0 && muted) {
      setMuted(false);
      shared.muted = false;
      try {
        localStorage.setItem(MUTE_KEY, "0");
      } catch {
        /* */
      }
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const nextM = !m;
      shared.muted = nextM;
      try {
        localStorage.setItem(MUTE_KEY, nextM ? "1" : "0");
      } catch {
        /* */
      }
      return nextM;
    });
  }

  function seek(ratio: number) {
    const a = getAudio();
    if (!a || !duration) return;
    a.currentTime = ratio * duration;
    setProgress(a.currentTime);
  }

  function fmt(t: number) {
    if (!Number.isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const isHome = path === "/" || path === "";

  return (
    <div
      className={`muzak-player${expanded ? " expanded" : ""}${
        isHome ? " lobby" : " node"
      }`}
      role="region"
      aria-label="Ambient music player"
    >
      <button
        type="button"
        className="muzak-toggle"
        onClick={() => setExpanded((x) => !x)}
        title={expanded ? "minimizar" : "expandir player"}
        aria-expanded={expanded}
      >
        {isHome ? "♪ LOBBY" : "♪ NODE"}
      </button>

      <div className="muzak-main">
        <div className="muzak-meta">
          <span className="muzak-zone">{playlist.label}</span>
          <span className="muzak-title" title={track?.title}>
            {track?.title || "—"}
          </span>
          <span className="muzak-artist">{track?.artist}</span>
        </div>

        <div className="muzak-controls">
          <button type="button" className="muzak-btn" onClick={prev} title="anterior">
            ‹‹
          </button>
          <button
            type="button"
            className="muzak-btn play"
            onClick={toggle}
            title={playing ? "pausa" : "play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" className="muzak-btn" onClick={next} title="siguiente">
            ››
          </button>
        </div>

        {expanded ? (
          <div className="muzak-extra">
            <div
              className="muzak-seek"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek((e.clientX - r.left) / r.width);
              }}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={progress}
              tabIndex={0}
            >
              <div
                className="muzak-seek-fill"
                style={{
                  width: duration ? `${(progress / duration) * 100}%` : "0%",
                }}
              />
            </div>
            <div className="muzak-times">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
            <div className="muzak-vol-row">
              <button
                type="button"
                className="muzak-btn"
                onClick={toggleMute}
                title="mute"
              >
                {muted || volume === 0 ? "🔇" : "🔊"}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onVol(Number(e.target.value))}
                aria-label="volumen"
              />
            </div>
            <ol className="muzak-list">
              {playlist.tracks.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={i === safeIndex ? "on" : ""}
                    onClick={() => {
                      shared.wasPlaying = true;
                      shared.index = i;
                      setIndex(i);
                      setPlaying(true);
                    }}
                  >
                    {i + 1}. {t.title}
                  </button>
                </li>
              ))}
            </ol>
            <p className="muzak-credit">
              {isHome
                ? "elevator / lounge muzak · playlist_para_home"
                : "ops signal · playlist_para_forum_y_donate"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
