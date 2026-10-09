// "6 Oct 2026, 21:48" — an exact date and time for comments, files and the
// activity log. Uses the viewer's own time zone.
export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
