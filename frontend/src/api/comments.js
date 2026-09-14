import client from './client';

export function listComments(taskId) {
  return client.get(`/tasks/${taskId}/comments`).then((res) => res.data);
}

export function createComment(taskId, content) {
  return client.post(`/tasks/${taskId}/comments`, { content }).then((res) => res.data);
}

export function deleteComment(id) {
  return client.delete(`/comments/${id}`);
}
