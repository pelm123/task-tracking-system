import client from './client';

export function listNotifications(unreadOnly) {
  return client
    .get('/notifications', { params: unreadOnly ? { unread: 'true' } : {} })
    .then((res) => res.data);
}

export function markAsRead(id) {
  return client.patch(`/notifications/${id}/read`).then((res) => res.data);
}

export function markAllAsRead() {
  return client.patch('/notifications/read-all').then((res) => res.data);
}
