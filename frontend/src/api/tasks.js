import client from './client';

export function listTasks(params = {}) {
  return client.get('/tasks', { params }).then((res) => res.data);
}

export function createTask(payload) {
  return client.post('/tasks', payload).then((res) => res.data);
}

export function updateTask(id, payload) {
  return client.patch(`/tasks/${id}`, payload).then((res) => res.data);
}

export function updateTaskStatus(id, status) {
  return client.patch(`/tasks/${id}/status`, { status }).then((res) => res.data);
}

export function deleteTask(id) {
  return client.delete(`/tasks/${id}`);
}
