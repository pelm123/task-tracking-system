import client from './client';

export function listUsers() {
  return client.get('/users').then((res) => res.data);
}
