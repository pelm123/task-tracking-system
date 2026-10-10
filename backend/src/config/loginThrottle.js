// Slows down password guessing: after too many failed logins for one email
// address, that address is locked for a while. Kept in memory (one backend
// process), so a restart clears it. Keyed by email rather than IP because in
// development every request arrives through the Vite proxy from 127.0.0.1.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map(); // email -> { count, firstAt, lockedUntil }

function key(email) {
  return String(email || '').trim().toLowerCase();
}

// Minutes left on the lock, or 0 if logging in is allowed.
function lockedMinutes(email, now = Date.now()) {
  const entry = failures.get(key(email));
  if (!entry || !entry.lockedUntil) return 0;
  if (entry.lockedUntil <= now) {
    failures.delete(key(email));
    return 0;
  }
  return Math.ceil((entry.lockedUntil - now) / 60000);
}

function recordFailure(email, now = Date.now()) {
  const k = key(email);
  let entry = failures.get(k);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    entry = { count: 0, firstAt: now, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now + WINDOW_MS;
  failures.set(k, entry);

  // drop stale entries so the map can't grow without limit
  if (failures.size > 10000) {
    for (const [k2, e] of failures) {
      if (now - e.firstAt > WINDOW_MS && (!e.lockedUntil || e.lockedUntil <= now)) failures.delete(k2);
    }
  }
}

function clearFailures(email) {
  failures.delete(key(email));
}

module.exports = { lockedMinutes, recordFailure, clearFailures, MAX_FAILURES };
