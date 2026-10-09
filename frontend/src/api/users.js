import client from './client';

export function listUsers() {
  return client.get('/users').then((res) => res.data);
}

export function listPendingUsers() {
  return client.get('/users/pending').then((res) => res.data);
}

export function approveUser(id) {
  return client.patch(`/users/${id}/approve`).then((res) => res.data);
}

export function updateUserRole(id, role) {
  return client.patch(`/users/${id}`, { role }).then((res) => res.data);
}

export function deleteUser(id) {
  return client.delete(`/users/${id}`);
}
