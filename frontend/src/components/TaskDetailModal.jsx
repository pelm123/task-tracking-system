import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
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

export default function TaskDetailModal({ task, users, onClose, onUpdate, onDelete, canApprove, onApprove, onDeny }) {
  const { user: currentUser } = useAuth();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [assigneeIds, setAssigneeIds] = useState((task.assignees || []).map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleAssignee(userId) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    commentsApi
      .listComments(task.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
    attachmentsApi.listAttachments(task.id).then(setAttachments);
    // task.updated_at changes whenever the task is approved/denied/edited
    // elsewhere (e.g. the real-time sync from another tab) — re-pull
    // comments then too, so a PM's required denial comment shows up here
    // without the person having to close and reopen the task.
  }, [task.id, task.updated_at]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onUpdate(task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee_ids: assigneeIds,
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
      setComments((prev) => [...prev, { ...created, author_name: currentUser.name }]);
      setCommentDraft('');
    } catch (err) {
      setError('Could not post comment');
    }
  }

  function startEditingComment(c) {
    setEditingCommentId(c.id);
    setEditDraft(c.content);
  }

  async function handleSaveCommentEdit(commentId) {
    const content = editDraft.trim();
    if (!content) return;
    try {
      const updated = await commentsApi.updateComment(commentId, content);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: updated.content } : c)));
      setEditingCommentId(null);
    } catch (err) {
      setError('Could not save comment edit');
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await commentsApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError('Could not delete comment');
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
            <label>
              Assign to{assigneeIds.length > 0 && ` (${assigneeIds.length} selected)`}
            </label>
            <div className={styles.assigneeList}>
              {users.length === 0 && <p className={styles.emptyText}>No users available.</p>}
              {users.map((u) => (
                <label key={u.id} className={styles.assigneeRow}>
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(u.id)}
                    onChange={() => toggleAssignee(u.id)}
                  />
                  <span className={styles.assigneeName}>
                    {u.name} <span className={styles.assigneeRole}>({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {task.status === 'review' && (
          <p className={styles.emptyText} style={{ margin: '0 0 12px' }}>
            {canApprove
              ? 'This task is awaiting your approval.'
              : 'This task is in Review, waiting for a PM to approve it before it can move to Done.'}
          </p>
        )}

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.btnDanger} onClick={handleDelete}>
            Delete
          </button>
          {task.status === 'review' && canApprove && (
            <>
              <button
                className={styles.btnDanger}
                onClick={() => onDeny(task.id)}
              >
                Deny — back to To Do
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => onApprove(task.id)}
              >
                Approve — move to Done
              </button>
            </>
          )}
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {timeAgo(c.created_at)}
                      {c.user_id === currentUser.id && editingCommentId !== c.id && (
                        <>
                          <button
                            onClick={() => startEditingComment(c)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--priority-high)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <button className={styles.btnPrimary} onClick={() => handleSaveCommentEdit(c.id)}>
                        Save
                      </button>
                      <button className={styles.btnGhost} onClick={() => setEditingCommentId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className={styles.commentBody}>{c.content}</p>
                  )}
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
