import client from './client';

export function listProjects() {
  return client.get('/projects').then((res) => res.data);
}

export function createProject(payload) {
  return client.post('/projects', payload).then((res) => res.data);
}

export function updateProject(id, payload) {
  return client.patch(`/projects/${id}`, payload).then((res) => res.data);
}

export function deleteProject(id) {
  return client.delete(`/projects/${id}`);
}
