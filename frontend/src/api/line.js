import client from './client';

export function getLinkCode() {
  return client.get('/line/link-code').then((res) => res.data);
}

export function unlinkLine() {
  return client.delete('/line/link').then((res) => res.data);
}

export function getNotificationPreferences() {
  return client.get('/line/preferences').then((res) => res.data);
}

export function updateNotificationPreferences(updates) {
  return client.patch('/line/preferences', updates).then((res) => res.data);
}
