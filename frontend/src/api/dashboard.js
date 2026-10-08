import client from './client';

export function getSummary(projectId) {
  return client.get('/dashboard/summary', { params: projectId ? { project_id: projectId } : {} }).then((res) => res.data);
}

export function getOverview() {
  return client.get('/dashboard/overview').then((res) => res.data);
}
