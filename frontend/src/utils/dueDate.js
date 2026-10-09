import { t, getLocale } from '../i18n';

// Shared helpers for the due-date countdown + custom reminder lead time,
// used by TaskCard, TaskDetailModal, NewTaskModal, and CalendarPage.

// Preset options for "remind me before due date". Hours must match what the
// backend accepts (an integer, 1–720). A custom number can still be typed
// in directly — this list is just the common shortcuts.
// `label` is a getter so it follows the current language.
const preset = (hours) => ({
  hours,
  get label() {
    return t(`reminders.h${hours}`);
  },
});
export const REMINDER_PRESETS = [1, 3, 12, 24, 48, 72, 168].map(preset);

export const DEFAULT_REMINDER_HOURS = 24;

// Due dates now carry a specific time too, defaulting to the end of the
// picked day when the person doesn't set one — this keeps old behavior
// (due "by end of day") as the default while allowing an exact time.
export const DEFAULT_DUE_TIME = '23:59';

// Combines a <input type="date"> value ("YYYY-MM-DD") and a
// <input type="time"> value ("HH:mm") into an ISO timestamp, treating both
// as the browser's own local timezone before converting. Sending a bare
// date to the backend used to get parsed as UTC midnight, which for any
// positive UTC offset (e.g. Bangkok, UTC+7) falls earlier that same
// morning — so a task due "today" looked already overdue the moment it was
// created. Always resolving a local date+time first avoids that.
export function dateInputToDueTimestamp(dateStr, timeStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || DEFAULT_DUE_TIME).split(':').map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);
  return local.toISOString();
}

// The inverse: given a due_date timestamp from the backend, return the
// "YYYY-MM-DD" the <input type="date"> should show. Must read LOCAL date
// parts (not toISOString, which converts to UTC) so a date picked and saved
// in this timezone round-trips to the same calendar day, including for
// negative UTC offsets where UTC-midnight slicing would show the next day.
export function toDateInputValue(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Same idea for the <input type="time">'s "HH:mm" value, read from local
// time parts.
export function toTimeInputValue(dueDate) {
  if (!dueDate) return DEFAULT_DUE_TIME;
  const d = new Date(dueDate);
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

// A task counts as overdue when it has a due date that's already passed and
// it isn't Done yet — finished work is never "late", even if it was finished
// after the deadline.
export function isOverdue(dueDate, status, now = new Date()) {
  if (!dueDate || status === 'done') return false;
  return new Date(dueDate).getTime() < now.getTime();
}

// Compact "how late" for badges: just the biggest unit — "3d", "5h", "20m".
export function formatOverdueShort(dueDate, now = new Date()) {
  const mins = Math.max(1, Math.floor((now.getTime() - new Date(dueDate).getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  if (days > 0) return `${days}${t('units.d')}`;
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}${t('units.h')}`;
  return `${mins}${t('units.m')}`;
}

// Returns { label, overdue, urgent } describing how far `dueDate` is from
// `now` (defaults to the current time). `urgent` is true inside the last
// 24 hours before the deadline, for a bit of extra visual warning.
export function getDueCountdown(dueDate, now = new Date()) {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const overdue = diffMs < 0;
  const absMinutes = Math.floor(Math.abs(diffMs) / 60000);

  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const minutes = absMinutes % 60;

  let text;
  const D = t('units.d');
  const H = t('units.h');
  const M = t('units.m');
  if (days > 0) {
    text = hours > 0 ? `${days}${D} ${hours}${H}` : `${days}${D}`;
  } else if (hours > 0) {
    text = minutes > 0 ? `${hours}${H} ${minutes}${M}` : `${hours}${H}`;
  } else {
    text = `${minutes}${M}`;
  }

  return {
    label: overdue ? t('dates.overdueBy', { text }) : t('dates.dueIn', { text }),
    overdue,
    urgent: !overdue && diffMs <= 24 * 60 * 60 * 1000,
  };
}

// Absolute due date for display next to (or instead of) the countdown, e.g.
// "Thu, Oct 9 · 6:00 PM". The year is added only when it isn't the current
// year, so most dates stay short. Uses the browser's local time, like the
// date/time pickers do.
export function formatDueDateShort(dueDate, now = new Date()) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  const date = d.toLocaleDateString(getLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  const time = d.toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}
