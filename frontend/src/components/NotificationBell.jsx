import { useState, useEffect, useRef, useCallback } from 'react';
import * as notificationsApi from '../api/notifications';
import socket from '../api/socket';
import {
  initNotificationSound,
  isSoundEnabled,
  setSoundEnabled,
  playNotificationSound,
  pickMostImportantType,
} from '../utils/notificationSound';
import styles from './notificationBell.module.css';
import { notificationMeta } from '../utils/notificationTypes';

// New notifications arrive instantly over the socket (see below); this slow
// poll is only a safety net in case the live connection is down.
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
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const wrapRef = useRef(null);
  // ids we've already seen, so only genuinely NEW notifications make a sound.
  // null until the first load finishes — the initial fetch (page open /
  // refresh) shouldn't chime for everything that was already waiting.
  const seenIdsRef = useRef(null);

  const load = useCallback(() => {
    notificationsApi
      .listNotifications()
      .then((list) => {
        if (seenIdsRef.current) {
          const fresh = list.filter((n) => !n.is_read && !seenIdsRef.current.has(n.id));
          if (fresh.length > 0) {
            playNotificationSound(pickMostImportantType(fresh.map((n) => n.type)));
          }
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));
        setNotifications(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initNotificationSound();
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playNotificationSound('assigned'); // preview, so you know it works
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    // browsers throttle timers in background tabs, so check straight away
    // when the tab becomes visible again
    function handleVisible() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', handleVisible);

    // Instant path: the server pushes "notification:new" the moment one is
    // created. (Re)join our private room on every (re)connect, then refresh.
    function joinUserRoom() {
      const token = localStorage.getItem('token');
      if (token) socket.emit('join-user', token);
    }
    if (socket.connected) joinUserRoom();
    socket.on('connect', joinUserRoom);
    socket.on('notification:new', load);

    return () => {
      socket.off('connect', joinUserRoom);
      socket.off('notification:new', load);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
    };
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
            <span className={styles.headerActions}>
              {unreadCount > 0 && (
                <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
              <button
                className={styles.soundBtn}
                onClick={toggleSound}
                title={soundOn ? 'Sound on — click to mute' : 'Sound off — click to turn on'}
                aria-label={soundOn ? 'Mute notification sounds' : 'Turn on notification sounds'}
              >
                {soundOn ? '🔊' : '🔇'}
              </button>
            </span>
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>You're all caught up.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                style={{ '--n-color': notificationMeta(n.type).color }}
                onClick={() => handleItemClick(n)}
              >
                <p className={styles.itemMessage}>
                  <span className={styles.typeTag}>{notificationMeta(n.type).label}</span>
                  {n.message}
                </p>
                <span className={styles.itemMeta}>{timeAgo(n.created_at)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
