const test = require('node:test');
const assert = require('node:assert');
const { scoreTask } = require('../src/config/risk');

const NOW = Date.parse('2026-10-09T00:00:00Z');
const inHours = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
const codes = (r) => r.reasons.map((x) => x.code);

test('done tasks are not scored', () => {
  assert.strictEqual(scoreTask({ status: 'done', due_date: inHours(-5) }, {}, NOW), null);
});

test('task without a due date is low risk', () => {
  const r = scoreTask({ status: 'todo', assignees: [{ id: 'a' }] }, {}, NOW);
  assert.strictEqual(r.level, 'low');
  assert.deepStrictEqual(r.reasons, []);
});

test('overdue task is high risk', () => {
  const r = scoreTask({ status: 'in_progress', due_date: inHours(-30), assignees: [{ id: 'a' }] }, {}, NOW);
  assert.strictEqual(r.level, 'high');
  assert.ok(codes(r).includes('overdue'));
});

test('not started with 1 day left is high; same date in review is lower', () => {
  const todo = scoreTask({ status: 'todo', due_date: inHours(24), assignees: [{ id: 'a' }] }, {}, NOW);
  const review = scoreTask({ status: 'review', due_date: inHours(24), assignees: [{ id: 'a' }] }, {}, NOW);
  assert.strictEqual(todo.level, 'high');
  assert.ok(codes(todo).includes('notStarted'));
  assert.ok(review.score < todo.score);
});

test('plenty of time means low risk', () => {
  const r = scoreTask({ status: 'todo', due_date: inHours(24 * 20), assignees: [{ id: 'a' }] }, {}, NOW);
  assert.strictEqual(r.level, 'low');
});

test('history shortens or lengthens the time needed', () => {
  const task = { status: 'todo', due_date: inHours(24 * 4), assignees: [{ id: 'a' }] };
  assert.strictEqual(scoreTask(task, { medianDays: 1 }, NOW).level, 'low');
  assert.notStrictEqual(scoreTask(task, { medianDays: 6 }, NOW).level, 'low');
});

test('overloaded assignee raises the score', () => {
  const task = { status: 'in_progress', due_date: inHours(24 * 10), assignees: [{ id: 'a' }] };
  const base = scoreTask(task, { openLoad: new Map([['a', 1]]) }, NOW);
  const busy = scoreTask(task, { openLoad: new Map([['a', 9]]) }, NOW);
  assert.ok(busy.score > base.score);
  assert.ok(codes(busy).includes('overloaded'));
});

test('unassigned task due soon is flagged', () => {
  const r = scoreTask({ status: 'in_progress', due_date: inHours(48), assignees: [] }, {}, NOW);
  assert.ok(codes(r).includes('unassigned'));
});
