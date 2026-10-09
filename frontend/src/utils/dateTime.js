import { getLocale, t } from '../i18n';

// "6 Oct 2026, 21:48" — an exact date and time for comments, files and the
// activity log. Uses the viewer's own time zone.
export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// "just now", "5m ago", "3h ago", "2d ago" — for feeds and notification lists.
export function timeAgo(value) {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  return t('time.daysAgo', { n: Math.floor(hours / 24) });
}
