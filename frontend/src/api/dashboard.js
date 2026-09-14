import client from './client';

export function getSummary() {
  return client.get('/dashboard/summary').then((res) => res.data);
}
