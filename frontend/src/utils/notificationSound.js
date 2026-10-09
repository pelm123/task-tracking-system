// Notification sound, synthesized with the Web Audio API — no audio files
// to ship or host. A single chime is used for every notification type.
//
// Browsers block audio until the user has interacted with the page once, so
// initNotificationSound() hooks the first click/keypress to unlock it.

const STORAGE_KEY = 'notificationSoundEnabled';

let ctx = null;
let unlockHooked = false;

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'; // on by default
  } catch (err) {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    // storage blocked — the setting just won't persist
  }
}

// Call once (e.g. when the bell mounts). Resumes the audio context on the
// first user gesture, which is what browsers require before they'll play.
export function initNotificationSound() {
  if (unlockHooked) return;
  unlockHooked = true;
  const unlock = () => {
    const c = getContext();
    if (c && c.state === 'suspended') c.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// One note: an oscillator with a quick attack and an exponential fade-out
// so it sounds like a soft chime/beep instead of a harsh click.
function tone(c, { freq, start = 0, duration = 0.18, type = 'sine', volume = 0.18 }) {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Note frequencies (Hz)
const C5 = 523.25;
const E5 = 659.25;

// One sound for every notification type — a soft rising two-note chime.
// (Types are still told apart by color in the bell; the sound just says
// "something new arrived".)
function chime(c) {
  tone(c, { freq: C5, start: 0, duration: 0.2 });
  tone(c, { freq: E5, start: 0.15, duration: 0.3 });
}

// Kept so callers don't change: when several notifications arrive together
// the sound is only played once anyway.
export function pickMostImportantType(types) {
  return types[0];
}

export function playNotificationSound() {
  if (!isSoundEnabled()) return;
  const c = getContext();
  if (!c) return;
  const play = chime;
  try {
    if (c.state === 'suspended') {
      // not unlocked yet (no user gesture) — resume() is a no-op/rejects
      // until then, so this silently does nothing rather than erroring
      c.resume().then(() => play(c)).catch(() => {});
    } else {
      play(c);
    }
  } catch (err) {
    // audio is a nice-to-have — never let it break the page
  }
}
