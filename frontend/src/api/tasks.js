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

export function approveTask(id) {
  return client.post(`/tasks/${id}/approve`).then((res) => res.data);
}

export function denyTask(id, reason) {
  return client.post(`/tasks/${id}/deny`, { reason }).then((res) => res.data);
}

export function deleteTask(id) {
  return client.delete(`/tasks/${id}`);
}

export function bulkUpdateStatus(taskIds, status) {
  return client.patch('/tasks/bulk/status', { taskIds, status }).then((res) => res.data);
}

export function bulkAssign(taskIds, assigneeId) {
  return client.patch('/tasks/bulk/assign', { taskIds, assignee_id: assigneeId }).then((res) => res.data);
}

export function bulkDelete(taskIds) {
  return client.delete('/tasks/bulk', { data: { taskIds } });
}
