import { useState, useEffect, useRef, useCallback } from 'react';
import * as notificationsApi from '../api/notifications';
import styles from './notificationBell.module.css';

const POLL_INTERVAL_MS = 30000;

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(() => {
    notificationsApi.listNotifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleItemClick(n) {
    if (!n.is_read) {
      try {
        await notificationsApi.markAsRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch (err) {
        // silent — not critical if this fails
      }
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      // silent
    }
  }

  return (
    <div className={styles.bellWrap} ref={wrapRef}>
      <button className={styles.bellBtn} onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>You're all caught up.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                onClick={() => handleItemClick(n)}
              >
                <p className={styles.itemMessage}>{n.message}</p>
                <span className={styles.itemMeta}>{timeAgo(n.created_at)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
