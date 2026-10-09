import client from './client';

export function getSummary(projectId) {
  return client.get('/dashboard/summary', { params: projectId ? { project_id: projectId } : {} }).then((res) => res.data);
}

// from / to are 'YYYY-MM-DD' (both days included); omit both for this month
export function getOverview(from, to) {
  const params = from && to ? { from, to } : {};
  return client.get('/dashboard/overview', { params }).then((res) => res.data);
}
