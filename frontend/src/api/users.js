import client from './client';

export function listUsers() {
  return client.get('/users').then((res) => res.data);
}

export function updateUserRole(id, role) {
  return client.patch(`/users/${id}`, { role }).then((res) => res.data);
}

export function deleteUser(id) {
  return client.delete(`/users/${id}`);
}
