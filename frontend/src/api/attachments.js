import client from './client';

export function listAttachments(taskId) {
  return client.get(`/tasks/${taskId}/attachments`).then((res) => res.data);
}

export function uploadAttachment(taskId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return client
    .post(`/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data);
}

export async function downloadAttachment(id, fileName) {
  const res = await client.get(`/attachments/${id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function deleteAttachment(id) {
  return client.delete(`/attachments/${id}`);
}
