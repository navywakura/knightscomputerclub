"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  label?: string;
};

/**
 * Música ambient del perfil público. Autoplay cuando el browser lo permite;
 * si no, un toque en play. Loop + volumen bajo por defecto.
 */
export default function ProfileMusicPlayer({
  src,
  label = "tema del perfil",
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const a = new Audio(src);
    a.loop = true;
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);

    a.play()
      .then(() => setBlocked(false))
      .catch(() => {
        setBlocked(true);
        setPlaying(false);
      });

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reiniciar solo si cambia src
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
    a.muted = muted;
  }, [volume, muted]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    } else {
      a.pause();
    }
  }

  return (
    <div className="profile-music" role="region" aria-label="música del perfil">
      <button
        type="button"
        className="profile-music-play"
        onClick={toggle}
        title={playing ? "pausar" : "reproducir"}
        aria-label={playing ? "pausar música" : "reproducir música"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="profile-music-meta">
        <span className="profile-music-label">♪ {label}</span>
        {blocked && !playing ? (
          <span className="profile-music-hint">tocá play para escuchar</span>
        ) : (
          <span className="profile-music-hint">
            {playing ? "sonando · loop" : "pausado"}
          </span>
        )}
      </div>
      <button
        type="button"
        className="profile-music-mute"
        onClick={() => setMuted((m) => !m)}
        title={muted ? "activar sonido" : "silenciar"}
        aria-label={muted ? "unmute" : "mute"}
      >
        {muted || volume === 0 ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        className="profile-music-vol"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVolume(v);
          if (v > 0) setMuted(false);
        }}
        aria-label="volumen"
      />
    </div>
  );
}
