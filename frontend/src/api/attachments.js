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

// Mirrors the backend's previewAttachment check — only images and PDFs get
// a preview option in the UI; everything else only offers Download.
export function isPreviewable(mimeType) {
  return Boolean(mimeType) && (mimeType.startsWith('image/') || mimeType === 'application/pdf');
}

// Fetches the file as a blob (so the request carries the same auth header
// as everything else through `client`) and hands back an object URL to put
// straight into an <img> or <iframe> src. Caller is responsible for
// revoking it (window.URL.revokeObjectURL) once the preview is closed.
export async function getPreviewUrl(id) {
  const res = await client.get(`/attachments/${id}/preview`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] }));
}
