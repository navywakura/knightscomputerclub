"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playlistForPath, type PlaylistId, type Track } from "@/lib/playlists";

const STATE_KEY = "kc_muzak_state_v1";
const SAVE_INTERVAL_MS = 2000;

type SavedState = {
  playing: boolean;
  playlistId: PlaylistId;
  index: number;
  currentTime: number;
  volume: number;
  muted: boolean;
  /** player colapsado a pastilla (sigue sonando) */
  minimized: boolean;
};

const DEFAULT_SAVED: SavedState = {
  playing: false,
  playlistId: "home",
  index: 0,
  currentTime: 0,
  volume: 0.35,
  muted: false,
  minimized: false,
};

/**
 * Estado + Audio fuera de React: sobrevive a remounts y a cambios de ruta.
 */
type SharedMuzak = {
  audio: HTMLAudioElement | null;
  playlistId: PlaylistId | null;
  index: number;
  wasPlaying: boolean;
  volume: number;
  muted: boolean;
  currentTime: number;
  hydrated: boolean;
  pendingSeek: number | null;
  unlockBound: boolean;
};

const shared: SharedMuzak = {
  audio: null,
  playlistId: null,
  index: 0,
  wasPlaying: false,
  volume: 0.35,
  muted: false,
  currentTime: 0,
  hydrated: false,
  pendingSeek: null,
  unlockBound: false,
};

function readSaved(): SavedState {
  if (typeof window === "undefined") return { ...DEFAULT_SAVED };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...DEFAULT_SAVED };
    const p = JSON.parse(raw) as Partial<SavedState>;
    return {
      playing: Boolean(p.playing),
      playlistId: p.playlistId === "ops" ? "ops" : "home",
      index: Math.max(0, Number(p.index) || 0),
      currentTime: Math.max(0, Number(p.currentTime) || 0),
      volume: Math.min(1, Math.max(0, Number(p.volume) ?? 0.35)),
      muted: Boolean(p.muted),
      minimized: Boolean(p.minimized),
    };
  } catch {
    return { ...DEFAULT_SAVED };
  }
}

function writeSaved(patch: Partial<SavedState>) {
  if (typeof window === "undefined") return;
  try {
    const prev = readSaved();
    const next: SavedState = {
      playing: patch.playing ?? prev.playing,
      playlistId: patch.playlistId ?? prev.playlistId,
      index: patch.index ?? prev.index,
      currentTime: patch.currentTime ?? prev.currentTime,
      volume: patch.volume ?? prev.volume,
      muted: patch.muted ?? prev.muted,
      minimized: patch.minimized ?? prev.minimized,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

function persistNow() {
  writeSaved({
    playing: shared.wasPlaying,
    playlistId: shared.playlistId || "home",
    index: shared.index,
    currentTime: shared.currentTime,
    volume: shared.volume,
    muted: shared.muted,
    // minimized se guarda al toggle; no lo pisa acá
  });
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!shared.audio) {
    const a = new Audio();
    a.preload = "auto";
    a.volume = shared.muted ? 0 : shared.volume;
    a.muted = shared.muted;
    shared.audio = a;
  }
  return shared.audio;
}

/** Intenta autoplay; si el browser bloquea, reanuda en el primer gesto. */
function tryAutoplay(a: HTMLAudioElement): Promise<boolean> {
  return a
    .play()
    .then(() => {
      shared.wasPlaying = true;
      persistNow();
      return true;
    })
    .catch(() => {
      // Mantener intención de reproducir; desbloquear con gesto
      shared.wasPlaying = true;
      persistNow();
      bindGestureUnlock(a);
      return false;
    });
}

function bindGestureUnlock(a: HTMLAudioElement) {
  if (shared.unlockBound || typeof document === "undefined") return;
  shared.unlockBound = true;

  const unlock = () => {
    if (!shared.wasPlaying) {
      cleanup();
      return;
    }
    a.play()
      .then(() => {
        persistNow();
        cleanup();
      })
      .catch(() => {
        /* sigue esperando otro gesto */
      });
  };

  const cleanup = () => {
    shared.unlockBound = false;
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    document.removeEventListener("touchstart", unlock, true);
  };

  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
  document.addEventListener("touchstart", unlock, true);
}

function loadTrack(
  a: HTMLAudioElement,
  src: string,
  resume: boolean,
  seekTo: number | null = null
) {
  const current = a.getAttribute("data-src");
  const same = current === src;

  if (!same) {
    a.setAttribute("data-src", src);
    a.src = src;
    a.load();
  }

  const applySeek = () => {
    const t = seekTo ?? shared.pendingSeek;
    if (t != null && t > 0 && Number.isFinite(t)) {
      try {
        const max = a.duration;
        if (Number.isFinite(max) && max > 0) {
          a.currentTime = Math.min(t, Math.max(0, max - 0.25));
        } else {
          a.currentTime = t;
        }
      } catch {
        /* ignore seek race */
      }
      shared.pendingSeek = null;
    }
  };

  if (same) {
    applySeek();
    if (resume && a.paused) {
      void tryAutoplay(a);
    }
    return;
  }

  const onReady = () => {
    a.removeEventListener("loadedmetadata", onReady);
    a.removeEventListener("canplay", onReady);
    applySeek();
    if (resume) void tryAutoplay(a);
  };
  a.addEventListener("loadedmetadata", onReady);
  a.addEventListener("canplay", onReady);
  // por si ya está listo
  if (a.readyState >= 1) onReady();
}

/**
 * Mini reproductor global.
 * Estado (play, track, posición, vol) en localStorage → autoplay al volver.
 */
export default function AmbientMusicPlayer() {
  const path = usePathname() || "/";
  const playlist = useMemo(() => playlistForPath(path), [path]);

  const [index, setIndex] = useState(shared.index);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(shared.muted);
  const [volume, setVolume] = useState(shared.volume);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastSave = useRef(0);

  const safeIndex = playlist.tracks.length
    ? index % playlist.tracks.length
    : 0;
  const track: Track | undefined = playlist.tracks[safeIndex];

  // zona body class
  useEffect(() => {
    const isHome = path === "/" || path === "";
    document.body.classList.add(isHome ? "zone-home" : "zone-ops");
    document.body.classList.remove(isHome ? "zone-ops" : "zone-home");
  }, [path]);

  // hidratar desde localStorage una sola vez
  useEffect(() => {
    if (shared.hydrated) {
      const a = getAudio();
      if (a) {
        setPlaying(!a.paused && !a.ended);
        setProgress(a.currentTime || 0);
        setDuration(a.duration || 0);
        setIndex(shared.index);
        setVolume(shared.volume);
        setMuted(shared.muted);
      }
      return;
    }

    const saved = readSaved();
    shared.hydrated = true;
    shared.volume = saved.volume;
    shared.muted = saved.muted;
    shared.wasPlaying = saved.playing;
    shared.volume = saved.volume;
    shared.currentTime = saved.currentTime;
    shared.pendingSeek = saved.currentTime > 1 ? saved.currentTime : null;

    // si la zona actual coincide con la guardada, restaurar índice;
    // si no, al entrar a la zona se aplicará la playlist de la ruta
    const pathPl = playlistForPath(
      typeof window !== "undefined" ? window.location.pathname : "/"
    );
    if (saved.playlistId === pathPl.id) {
      shared.index = saved.index % Math.max(pathPl.tracks.length, 1);
      shared.playlistId = null; // forzar setup con seek en el effect de zona
    } else {
      // otra zona: al menos restaurar si querían play en esta zona
      shared.index = 0;
      shared.playlistId = null;
      shared.pendingSeek = null;
    }

    setVolume(shared.volume);
    setMuted(shared.muted);
    setIndex(shared.index);
    setMinimized(Boolean(saved.minimized));

    const a = getAudio();
    if (a) {
      a.volume = shared.muted ? 0 : shared.volume;
      a.muted = shared.muted;
    }

    // guardar al salir de la pestaña / cerrar
    const onHide = () => {
      const el = getAudio();
      if (el) shared.currentTime = el.currentTime || 0;
      // si el browser pausó al background, no borrar intención de play
      persistNow();
    };
    const onBeforeUnload = () => {
      const el = getAudio();
      if (el) shared.currentTime = el.currentTime || 0;
      persistNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onBeforeUnload);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onBeforeUnload);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const a = getAudio();
    if (!a) return;
    shared.volume = volume;
    shared.muted = muted;
    a.volume = muted ? 0 : volume;
    a.muted = muted;
    writeSaved({ volume, muted });
  }, [volume, muted]);

  // listeners audio
  useEffect(() => {
    const a = getAudio();
    if (!a) return;

    const onTime = () => {
      shared.currentTime = a.currentTime;
      setProgress(a.currentTime);
      const now = Date.now();
      if (now - lastSave.current >= SAVE_INTERVAL_MS) {
        lastSave.current = now;
        persistNow();
      }
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => {
      shared.wasPlaying = true;
      setPlaying(true);
      persistNow();
    };
    const onPause = () => {
      setPlaying(false);
      // solo persistir pause "real" si el user pausó (wasPlaying false)
      // load() también dispara pause — no tocar wasPlaying aquí
      if (a) shared.currentTime = a.currentTime || 0;
      persistNow();
    };
    const onEnded = () => {
      shared.wasPlaying = true;
      setIndex((i) => {
        const pl = playlistForPath(
          typeof window !== "undefined" ? window.location.pathname : "/"
        );
        const len = Math.max(pl.tracks.length, 1);
        const next = (i + 1) % len;
        shared.index = next;
        shared.currentTime = 0;
        shared.pendingSeek = null;
        writeSaved({
          playing: true,
          index: next,
          currentTime: 0,
          playlistId: pl.id,
        });
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

  // zona / playlist
  useEffect(() => {
    const a = getAudio();
    if (!a || !shared.hydrated) return;

    if (shared.playlistId === playlist.id) {
      setIndex(shared.index);
      setPlaying(!a.paused && !a.ended);
      return;
    }

    // cambiar de zona O primer setup
    const keep = shared.wasPlaying;
    const saved = readSaved();
    const restoreIndex =
      saved.playlistId === playlist.id
        ? saved.index % Math.max(playlist.tracks.length, 1)
        : 0;
    const restoreTime =
      saved.playlistId === playlist.id ? saved.currentTime : 0;

    shared.playlistId = playlist.id;
    shared.index = restoreIndex;
    setIndex(restoreIndex);
    setProgress(restoreTime);
    setDuration(0);

    if (restoreTime > 1) shared.pendingSeek = restoreTime;
    else shared.pendingSeek = null;

    const t = playlist.tracks[restoreIndex] || playlist.tracks[0];
    if (!t) {
      a.pause();
      setPlaying(false);
      return;
    }

    writeSaved({
      playlistId: playlist.id,
      index: restoreIndex,
      currentTime: restoreTime,
      playing: keep,
    });

    loadTrack(a, t.src, keep, restoreTime > 1 ? restoreTime : null);
    setPlaying(keep);
  }, [playlist.id, playlist]);

  // track change dentro de la zona
  useEffect(() => {
    const a = getAudio();
    if (!a || !track || !shared.hydrated) return;
    if (shared.playlistId !== playlist.id) return;

    const prevIndex = shared.index;
    shared.index = safeIndex;

    // si solo rehidratamos el mismo track, no forzar reload sin seek
    const seek =
      prevIndex === safeIndex ? shared.pendingSeek : null;
    if (prevIndex !== safeIndex) {
      shared.currentTime = 0;
      shared.pendingSeek = null;
      writeSaved({
        index: safeIndex,
        currentTime: 0,
        playlistId: playlist.id,
        playing: shared.wasPlaying,
      });
    }

    const resume = shared.wasPlaying || !a.paused || playing;
    loadTrack(a, track.src, resume, seek);
  }, [safeIndex, track, playlist.id, playing]);

  const next = useCallback(() => {
    shared.wasPlaying = true;
    shared.pendingSeek = null;
    setIndex((i) => {
      const n = (i + 1) % Math.max(playlist.tracks.length, 1);
      shared.index = n;
      shared.currentTime = 0;
      writeSaved({
        playing: true,
        index: n,
        currentTime: 0,
        playlistId: playlist.id,
      });
      return n;
    });
  }, [playlist.tracks.length, playlist.id]);

  const prev = useCallback(() => {
    shared.wasPlaying = true;
    shared.pendingSeek = null;
    setIndex((i) => {
      const n =
        i <= 0 ? Math.max(playlist.tracks.length - 1, 0) : i - 1;
      shared.index = n;
      shared.currentTime = 0;
      writeSaved({
        playing: true,
        index: n,
        currentTime: 0,
        playlistId: playlist.id,
      });
      return n;
    });
  }, [playlist.tracks.length, playlist.id]);

  async function toggle() {
    const a = getAudio();
    if (!a) return;
    if (!a.paused) {
      a.pause();
      shared.wasPlaying = false;
      shared.currentTime = a.currentTime || 0;
      setPlaying(false);
      persistNow();
      return;
    }
    try {
      if (!a.getAttribute("data-src") && track) {
        loadTrack(a, track.src, false, shared.currentTime || null);
      }
      await a.play();
      shared.wasPlaying = true;
      setPlaying(true);
      persistNow();
    } catch {
      shared.wasPlaying = true;
      bindGestureUnlock(a);
      setPlaying(false);
      persistNow();
    }
  }

  function onVol(v: number) {
    setVolume(v);
    shared.volume = v;
    writeSaved({ volume: v });
    if (v > 0 && muted) {
      setMuted(false);
      shared.muted = false;
      writeSaved({ muted: false, volume: v });
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const nextM = !m;
      shared.muted = nextM;
      writeSaved({ muted: nextM });
      return nextM;
    });
  }

  function seek(ratio: number) {
    const a = getAudio();
    if (!a || !duration) return;
    a.currentTime = ratio * duration;
    shared.currentTime = a.currentTime;
    setProgress(a.currentTime);
    persistNow();
  }

  function fmt(t: number) {
    if (!Number.isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const isHome = path === "/" || path === "";

  function setMinimizedPersist(next: boolean) {
    setMinimized(next);
    writeSaved({ minimized: next });
    if (next) setExpanded(false);
  }

  return (
    <div
      className={`muzak-player${expanded ? " expanded" : ""}${
        minimized ? " minimized" : ""
      }${isHome ? " lobby" : " node"}`}
      role="region"
      aria-label="Ambient music player"
    >
      {minimized ? (
        <div className="muzak-mini">
          <button
            type="button"
            className="muzak-btn play"
            onClick={toggle}
            title={playing ? "pausa" : "play"}
            aria-label={playing ? "pausa" : "play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="muzak-mini-label"
            onClick={() => setMinimizedPersist(false)}
            title="abrir reproductor"
          >
            <span className="muzak-mini-icon" aria-hidden>
              ♪
            </span>
            <span className="muzak-mini-title">
              {track?.title || (isHome ? "LOBBY" : "NODE")}
            </span>
            {playing ? <span className="muzak-mini-eq" aria-hidden /> : null}
          </button>
          <button
            type="button"
            className="muzak-btn muzak-mini-open"
            onClick={() => setMinimizedPersist(false)}
            title="expandir"
            aria-label="expandir reproductor"
          >
            ▴
          </button>
        </div>
      ) : (
        <>
      <div className="muzak-bar">
        <button
          type="button"
          className="muzak-toggle"
          onClick={() => setExpanded((x) => !x)}
          title={expanded ? "ocultar lista" : "mostrar lista y volumen"}
          aria-expanded={expanded}
        >
          {isHome ? "♪ LOBBY" : "♪ NODE"}
          <span className="muzak-toggle-hint">
            {expanded ? " · lista" : ""}
          </span>
        </button>
        <button
          type="button"
          className="muzak-min-btn"
          onClick={() => setMinimizedPersist(true)}
          title="minimizar reproductor"
          aria-label="minimizar reproductor"
        >
          —
        </button>
      </div>

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
          <button
            type="button"
            className="muzak-btn muzak-min-inline"
            onClick={() => setMinimizedPersist(true)}
            title="minimizar"
          >
            min
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
                      shared.currentTime = 0;
                      shared.pendingSeek = null;
                      writeSaved({
                        playing: true,
                        index: i,
                        currentTime: 0,
                        playlistId: playlist.id,
                      });
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
              {shared.wasPlaying && !playing ? (
                <span className="muted"> · autoplay pendiente (click en la página)</span>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}
