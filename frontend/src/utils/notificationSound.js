// Notification sounds, synthesized with the Web Audio API — no audio files
// to ship or host. Each notification type gets its own short, distinct
// sound so you can tell what happened without looking.
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
const C4 = 261.63;
const E4 = 329.63;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;

const SOUNDS = {
  // urgent: three quick, sharp beeps
  due_soon: (c) => {
    [0, 0.16, 0.32].forEach((s) => tone(c, { freq: A5, start: s, duration: 0.12, type: 'square', volume: 0.1 }));
  },
  // "you've been given something": rising two-note chime
  assigned: (c) => {
    tone(c, { freq: C5, start: 0, duration: 0.2 });
    tone(c, { freq: E5, start: 0.15, duration: 0.3 });
  },
  // light, friendly pop
  comment: (c) => {
    tone(c, { freq: A5, duration: 0.14, volume: 0.14 });
  },
  // neutral two-note
  status_change: (c) => {
    tone(c, { freq: E5, start: 0, duration: 0.14 });
    tone(c, { freq: G5, start: 0.12, duration: 0.18 });
  },
  // success: bright rising triad
  approved: (c) => {
    tone(c, { freq: C5, start: 0, duration: 0.16 });
    tone(c, { freq: E5, start: 0.12, duration: 0.16 });
    tone(c, { freq: G5, start: 0.24, duration: 0.34 });
  },
  // sent back: low, falling two-note
  approval_denied: (c) => {
    tone(c, { freq: E4, start: 0, duration: 0.22, type: 'triangle', volume: 0.22 });
    tone(c, { freq: C4, start: 0.2, duration: 0.36, type: 'triangle', volume: 0.22 });
  },
  // minor edit: barely-there tick
  task_updated: (c) => {
    tone(c, { freq: G5, duration: 0.08, volume: 0.07 });
  },
};

// When several notifications land in the same poll, only the most important
// one makes a sound — a burst of five chimes at once is just noise.
const PRIORITY = ['due_soon', 'approval_denied', 'assigned', 'approved', 'comment', 'status_change', 'task_updated'];

export function pickMostImportantType(types) {
  return PRIORITY.find((t) => types.includes(t)) || types[0];
}

export function playNotificationSound(type) {
  if (!isSoundEnabled()) return;
  const c = getContext();
  if (!c) return;
  const play = SOUNDS[type] || SOUNDS.comment;
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
