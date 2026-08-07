/**
 * Coordinación entre AmbientMusicPlayer (global) y ProfileMusicPlayer.
 * Cuando un perfil tiene MP3 propio, solo debe sonar ese.
 */

type SharedAmbient = {
  audio: HTMLAudioElement | null;
  wasPlaying: boolean;
  profileOverride: boolean;
  pausedByProfile: boolean;
};

// reutiliza el mismo patrón que AmbientMusicPlayer (module-level)
// AmbientMusicPlayer expone getAudio via este módulo al setear refs

let ambientAudio: HTMLAudioElement | null = null;
let wasPlaying = false;
let profileOverride = false;
let pausedByProfile = false;

export function registerAmbientAudio(a: HTMLAudioElement | null) {
  ambientAudio = a;
}

export function setAmbientWasPlaying(v: boolean) {
  wasPlaying = v;
}

export function isProfileMusicActive(): boolean {
  return profileOverride;
}

/** Llamar al montar ProfileMusicPlayer (hay MP3 custom) */
export function pauseAmbientForProfile() {
  profileOverride = true;
  const a = ambientAudio;
  if (a && !a.paused) {
    pausedByProfile = true;
    wasPlaying = true;
    a.pause();
  } else if (a) {
    // ya pausado: no reanudar al salir si el user no tenía play
    pausedByProfile = wasPlaying;
  }
  if (typeof document !== "undefined") {
    document.body.classList.add("profile-music-active");
  }
}

/** Llamar al desmontar ProfileMusicPlayer */
export function resumeAmbientFromProfile() {
  profileOverride = false;
  if (typeof document !== "undefined") {
    document.body.classList.remove("profile-music-active");
  }
  const a = ambientAudio;
  if (a && pausedByProfile && wasPlaying) {
    void a.play().catch(() => {});
  }
  pausedByProfile = false;
}

export function getAmbientSharedState(): SharedAmbient {
  return {
    audio: ambientAudio,
    wasPlaying,
    profileOverride,
    pausedByProfile,
  };
}
