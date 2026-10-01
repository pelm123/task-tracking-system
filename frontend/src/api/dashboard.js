import client from './client';

export function getSummary(projectId) {
  return client.get('/dashboard/summary', { params: projectId ? { project_id: projectId } : {} }).then((res) => res.data);
}
