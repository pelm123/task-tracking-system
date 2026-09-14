import { useEffect, useState, useRef } from 'react';
import * as commentsApi from '../api/comments';
import * as attachmentsApi from '../api/attachments';
import styles from './modal.module.css';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TaskDetailModal({ task, users, onClose, onUpdate, onDelete }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    commentsApi
      .listComments(task.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
    attachmentsApi.listAttachments(task.id).then(setAttachments);
  }, [task.id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onUpdate(task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee_id: assigneeId || null,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      setError('Could not delete task');
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    const content = commentDraft.trim();
    if (!content) return;
    try {
      const created = await commentsApi.createComment(task.id, content);
      setComments((prev) => [...prev, created]);
      setCommentDraft('');
    } catch (err) {
      setError('Could not post comment');
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await attachmentsApi.uploadAttachment(task.id, file);
      setAttachments((prev) => [created, ...prev]);
    } catch (err) {
      setError('Could not upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(att) {
    try {
      await attachmentsApi.downloadAttachment(att.id, att.file_name);
    } catch (err) {
      setError('Could not download file');
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Task details</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="dTitle">Title</label>
          <input id="dTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="dDescription">Description</label>
          <textarea
            id="dDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="dPriority">Priority</label>
            <select id="dPriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="dAssignee">Assign to</label>
            <select id="dAssignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.btnDanger} onClick={handleDelete}>
            Delete
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Comments</p>

          {loadingComments ? (
            <p className={styles.emptyText}>Loading…</p>
          ) : comments.length === 0 ? (
            <p className={styles.emptyText}>No comments yet.</p>
          ) : (
            <div className={styles.commentList}>
              {comments.map((c) => (
                <div key={c.id} className={styles.commentItem}>
                  <div className={styles.commentMeta}>
                    <span>{c.author_name}</span>
                    <span>{timeAgo(c.created_at)}</span>
                  </div>
                  <p className={styles.commentBody}>{c.content}</p>
                </div>
              ))}
            </div>
          )}

          <form className={styles.commentForm} onSubmit={handleAddComment}>
            <input
              placeholder="Write a comment…"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
            <button type="submit" className={styles.btnPrimary}>
              Post
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Attachments</p>

          {attachments.length === 0 ? (
            <p className={styles.emptyText}>No files attached.</p>
          ) : (
            <div className={styles.attachmentList}>
              {attachments.map((a) => (
                <div key={a.id} className={styles.attachmentItem}>
                  <button className={styles.attachmentName} onClick={() => handleDownload(a)}>
                    {a.file_name}
                  </button>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {(a.file_size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} disabled={uploading} />
          {uploading && <p className={styles.emptyText}>Uploading…</p>}
        </div>
      </div>
    </div>
  );
}
