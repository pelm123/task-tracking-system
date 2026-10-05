import client from './client';

export function getLinkCode() {
  return client.get('/line/link-code').then((res) => res.data);
}

export function unlinkLine() {
  return client.delete('/line/link').then((res) => res.data);
}
