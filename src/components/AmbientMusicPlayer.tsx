"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { playlistForPath, type Track } from "@/lib/playlists";

const VOL_KEY = "kc_muzak_vol";
const MUTE_KEY = "kc_muzak_muted";

/**
 * Mini reproductor global.
 * HOME → homeplaylist (elevator).
 * /forum y /donate → forumanddonateplaylist.
 */
export default function AmbientMusicPlayer() {
  const path = usePathname() || "/";
  const playlist = playlistForPath(path);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const wasPlaying = useRef(false);
  const playlistIdRef = useRef(playlist.id);

  const track: Track =
    playlist.tracks[index % playlist.tracks.length] || playlist.tracks[0];

  // zona body class (solo home cambia estética)
  useEffect(() => {
    const isHome = path === "/" || path === "";
    document.body.classList.toggle("zone-home", isHome);
    document.body.classList.toggle("zone-ops", !isHome);
    return () => {
      document.body.classList.remove("zone-home", "zone-ops");
    };
  }, [path]);

  // volume / mute persist
  useEffect(() => {
    try {
      const v = localStorage.getItem(VOL_KEY);
      if (v != null) setVolume(Math.min(1, Math.max(0, Number(v))));
      const m = localStorage.getItem(MUTE_KEY);
      if (m === "1") setMuted(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
    a.muted = muted;
  }, [volume, muted]);

  // cambio de playlist al navegar
  useEffect(() => {
    if (playlistIdRef.current === playlist.id) return;
    playlistIdRef.current = playlist.id;
    const keep = wasPlaying.current || playing;
    setIndex(0);
    setProgress(0);
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.src = playlist.tracks[0]?.src || "";
    a.load();
    if (keep) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      setPlaying(false);
    }
  }, [playlist.id, playlist.tracks, playing]);

  // load track when index changes within same playlist
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (a.getAttribute("data-src") === track.src) return;
    const resume = wasPlaying.current || playing;
    a.setAttribute("data-src", track.src);
    a.src = track.src;
    a.load();
    if (resume) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [track, playing]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(playlist.tracks.length, 1));
    wasPlaying.current = true;
  }, [playlist.tracks.length]);

  const prev = useCallback(() => {
    setIndex((i) =>
      i <= 0 ? Math.max(playlist.tracks.length - 1, 0) : i - 1
    );
    wasPlaying.current = true;
  }, [playlist.tracks.length]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      wasPlaying.current = false;
      return;
    }
    try {
      if (!a.src && track) {
        a.src = track.src;
        a.setAttribute("data-src", track.src);
      }
      await a.play();
      setPlaying(true);
      wasPlaying.current = true;
    } catch {
      setPlaying(false);
    }
  }

  function onVol(v: number) {
    setVolume(v);
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* */
    }
    if (v > 0 && muted) {
      setMuted(false);
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
      try {
        localStorage.setItem(MUTE_KEY, nextM ? "1" : "0");
      } catch {
        /* */
      }
      return nextM;
    });
  }

  function seek(ratio: number) {
    const a = audioRef.current;
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
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          wasPlaying.current = true;
          next();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

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
                    className={i === index % playlist.tracks.length ? "on" : ""}
                    onClick={() => {
                      wasPlaying.current = true;
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
              non-copyright elevator / lounge jazz · {playlist.zone}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
