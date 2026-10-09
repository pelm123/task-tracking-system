// One color + short label per notification type, shared by the bell dropdown
// and the Home page's "Recent updates" so a type looks the same everywhere.
// Colors reuse the app's design tokens where one fits; "sent back" has no
// token, so it gets its own rose.
export const NOTIFICATION_TYPES = {
  overdue:         { label: 'Overdue',    color: 'var(--priority-high)' },
  due_soon:        { label: 'Due soon',   color: 'var(--priority-medium)' },
  assigned:        { label: 'Assigned',   color: 'var(--color-accent)' },
  comment:         { label: 'Comment',    color: 'var(--status-review)' },
  status_change:   { label: 'Status',     color: 'var(--status-in-progress)' },
  approved:        { label: 'Approved',   color: 'var(--status-done)' },
  approval_denied: { label: 'Sent back',  color: '#d9779b' },
  task_updated:    { label: 'Edited',     color: 'var(--status-todo)' },
};

const FALLBACK = { label: 'Update', color: 'var(--color-text-muted)' };

export function notificationMeta(type) {
  return NOTIFICATION_TYPES[type] || FALLBACK;
}
