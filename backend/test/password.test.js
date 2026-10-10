const test = require('node:test');
const assert = require('node:assert');
const { validatePassword } = require('../src/config/password');
const { lockedMinutes, recordFailure, clearFailures, MAX_FAILURES } = require('../src/config/loginThrottle');

test('accepts a strong password', () => {
  assert.strictEqual(validatePassword('Blue-Kite-42', { email: 'somchai@example.com', name: 'Somchai' }), null);
});

test('rejects short, weak, long and personal passwords', () => {
  assert.match(validatePassword('Ab1!'), /at least 8/);
  assert.match(validatePassword('alllowercase1!'), /uppercase/);
  assert.match(validatePassword('NoNumbers!!'), /uppercase/);
  assert.match(validatePassword('NoSymbols123'), /uppercase/);
  assert.match(validatePassword(`Aa1!${'x'.repeat(69)}`), /too long/);
  assert.match(validatePassword(' Leading1!'), /space/);
  assert.match(validatePassword('P@ssw0rd'), /too common/);
  assert.match(validatePassword('Somchai#2026', { name: 'Somchai' }), /name or email/);
  assert.match(validatePassword('X!somchai99', { email: 'somchai99@example.com' }), /name or email/);
  assert.match(validatePassword(undefined), /required/);
});

test('counts multi-byte characters against the 72-byte bcrypt limit', () => {
  // 24 Thai characters are 72 bytes; 25 are over the limit
  assert.match(validatePassword(`Aa1!${'ก'.repeat(23)}`), /too long/);
});

test('locks an email after repeated failures and clears on success', () => {
  const now = 1_000_000;
  for (let i = 0; i < MAX_FAILURES - 1; i += 1) recordFailure('A@x.com', now);
  assert.strictEqual(lockedMinutes('a@x.com', now), 0);
  recordFailure('a@x.com', now);
  assert.strictEqual(lockedMinutes('a@x.com', now), 15);
  assert.strictEqual(lockedMinutes('a@x.com', now + 15 * 60 * 1000), 0);
  recordFailure('b@x.com', now);
  clearFailures('B@x.com');
  recordFailure('b@x.com', now);
  assert.strictEqual(lockedMinutes('b@x.com', now), 0);
});
