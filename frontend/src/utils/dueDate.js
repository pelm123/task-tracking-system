// Shared helpers for the due-date countdown + custom reminder lead time,
// used by TaskCard, TaskDetailModal, NewTaskModal, and CalendarPage.

// Preset options for "remind me before due date". Hours must match what the
// backend accepts (an integer, 1–720). A custom number can still be typed
// in directly — this list is just the common shortcuts.
export const REMINDER_PRESETS = [
  { hours: 1, label: '1 hour before' },
  { hours: 3, label: '3 hours before' },
  { hours: 12, label: '12 hours before' },
  { hours: 24, label: '1 day before' },
  { hours: 48, label: '2 days before' },
  { hours: 72, label: '3 days before' },
  { hours: 168, label: '1 week before' },
];

export const DEFAULT_REMINDER_HOURS = 24;

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
  if (days > 0) {
    text = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  } else if (hours > 0) {
    text = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    text = `${minutes}m`;
  }

  return {
    label: overdue ? `Overdue by ${text}` : `Due in ${text}`,
    overdue,
    urgent: !overdue && diffMs <= 24 * 60 * 60 * 1000,
  };
}
