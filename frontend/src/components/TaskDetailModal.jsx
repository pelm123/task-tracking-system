import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as commentsApi from '../api/comments';
import * as attachmentsApi from '../api/attachments';
import {
  REMINDER_PRESETS,
  DEFAULT_REMINDER_HOURS,
  getDueCountdown,
  toDateInputValue,
  toTimeInputValue,
  dateInputToDueTimestamp,
} from '../utils/dueDate';
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
  const [dueDate, setDueDate] = useState(toDateInputValue(task.due_date));
  const [dueTime, setDueTime] = useState(toTimeInputValue(task.due_date));
  const [reminderHours, setReminderHours] = useState(task.reminder_hours_before ?? DEFAULT_REMINDER_HOURS);
  const [assigneeIds, setAssigneeIds] = useState((task.assignees || []).map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ticks every 30s so the "Due in Xh Ym" / "Overdue by..." countdown stays
  // live while the modal is open, without re-fetching anything
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const countdown = getDueCountdown(task.due_date, now);

  // Members can only reschedule tasks they're assigned to — not anyone
  // else's. PM/admin can reschedule any task. Mirrors the backend check in
  // updateTask.
  const isAssignee = (task.assignees || []).some((a) => a.id === currentUser.id);
  // The task's own creator can always edit/comment/upload on it, even
  // before anyone (including themselves) is assigned — otherwise a member
  // who creates a task without assigning themselves would be instantly
  // locked out of their own task. Mirrors the backend checks.
  const isCreator = task.created_by === currentUser.id;
  const canReschedule = currentUser.role !== 'member' || isAssignee || isCreator;
  // A member who isn't assigned to this task yet, and didn't create it,
  // can't assign it (to themselves or anyone else), comment on it, or
  // upload files to it — only a PM/admin assigning them changes that.
  // Mirrors the backend checks in updateTask/createComment/uploadAttachment.
  const isUnassignedMember = currentUser.role === 'member' && !isAssignee && !isCreator;
  // admin/pm can delete any task; a member can delete only a task they
  // created themselves — mirrors the backend check in deleteTask
  const canDelete = canApprove || task.created_by === currentUser.id;

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

  // Only (re)load comments/attachments when switching to a different task —
  // NOT on every task.updated_at change. That used to also be a dependency
  // here so a PM's denial comment would show up live, but task.updated_at
  // changes on ANY edit to the task (status, approve/deny, title, priority,
  // due date, reminder — by anyone, from real-time sync), which with
  // several people testing the same task fires constantly. Each firing
  // replaced the entire `comments` array wholesale, which could land
  // mid-edit and leave an open "edit comment" box pointing at a comment
  // object that had just been swapped out from under it — Save would then
  // silently no-op. The denial comment is now merged in separately below
  // instead of forcing a full refetch.
  useEffect(() => {
    commentsApi
      .listComments(task.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
    attachmentsApi.listAttachments(task.id).then(setAttachments);
  }, [task.id]);

  // denyTask's response carries the required denial comment it just
  // created — merge it straight into the local list (once) instead of
  // refetching the whole comments array, so it shows up live without the
  // disruptive full-replacement behavior described above.
  useEffect(() => {
    if (!task.denialComment) return;
    setComments((prev) =>
      prev.some((c) => c.id === task.denialComment.id) ? prev : [...prev, task.denialComment]
    );
  }, [task.denialComment]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onUpdate(task.id, {
        // an unassigned member can't edit title/description/priority either
        // — every field below is disabled in that case, but echo back the
        // original values regardless so a stray save is always a no-op
        title: isUnassignedMember ? task.title : title.trim(),
        description: isUnassignedMember ? task.description || '' : description.trim(),
        priority: isUnassignedMember ? task.priority : priority,
        // only send a due_date change when the person was actually allowed
        // to make one — a disabled input never changes, but this keeps the
        // request honest even if that ever stops being true
        due_date: canReschedule
          ? (dueDate ? dateInputToDueTimestamp(dueDate, dueTime) : null)
          : task.due_date || null,
        // same permission as the due date itself — only someone who can
        // reschedule the task can change how far ahead it warns them
        reminder_hours_before: canReschedule ? reminderHours : task.reminder_hours_before,
        // an unassigned member can't change who's assigned — send the
        // original set back unchanged even if local state somehow drifted
        assignee_ids: isUnassignedMember ? (task.assignees || []).map((a) => a.id) : assigneeIds,
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

  // Mirrors the backend rule in deleteAttachment: admin/pm can delete any
  // file; a member can delete a file they uploaded themselves, or any file
  // on a task they're assigned to or created.
  function canDeleteAttachment(att) {
    return canApprove || isCreator || isAssignee || att.uploaded_by === currentUser.id;
  }

  async function handleDeleteAttachment(att) {
    if (!window.confirm(`Delete "${att.file_name}"? This cannot be undone.`)) return;
    try {
      await attachmentsApi.deleteAttachment(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete file');
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

        {isUnassignedMember && (
          <p className={styles.emptyText} style={{ margin: '0 0 12px' }}>
            You're not assigned to this task, so you can view it but can't edit it.
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="dTitle">Title</label>
          <input
            id="dTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUnassignedMember}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="dDescription">Description</label>
          <textarea
            id="dDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUnassignedMember}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="dPriority">Priority</label>
            <select
              id="dPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isUnassignedMember}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="dDueDate">Due date</label>
            <input
              id="dDueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canReschedule}
              title={canReschedule ? undefined : 'Only assigned members can reschedule this task'}
            />
            {countdown && (
              <p
                className={styles.emptyText}
                style={{
                  marginTop: 4,
                  color: countdown.overdue
                    ? 'var(--priority-high)'
                    : countdown.urgent
                    ? 'var(--priority-medium)'
                    : undefined,
                  fontWeight: countdown.overdue || countdown.urgent ? 600 : undefined,
                }}
              >
                {countdown.label}
              </p>
            )}
            {!canReschedule && (
              <p className={styles.emptyText} style={{ marginTop: 4 }}>
                You're not assigned to this task, so you can't reschedule it.
              </p>
            )}
          </div>

          {dueDate && (
            <div className={styles.field}>
              <label htmlFor="dDueTime">Due time</label>
              <input
                id="dDueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!canReschedule}
                title={canReschedule ? undefined : 'Only assigned members can reschedule this task'}
              />
            </div>
          )}

          {dueDate && (
            <div className={styles.field}>
              <label htmlFor="dReminder">Remind me</label>
              <select
                id="dReminder"
                value={reminderHours}
                onChange={(e) => setReminderHours(Number(e.target.value))}
                disabled={!canReschedule}
                title={canReschedule ? undefined : 'Only assigned members can change the reminder time'}
              >
                {REMINDER_PRESETS.map((opt) => (
                  <option key={opt.hours} value={opt.hours}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                    disabled={isUnassignedMember}
                  />
                  <span className={styles.assigneeName}>
                    {u.name} <span className={styles.assigneeRole}>({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
            {isUnassignedMember && (
              <p className={styles.emptyText} style={{ marginTop: 4 }}>
                A PM/admin has to assign you to this task before you can assign it to yourself or others.
              </p>
            )}
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
          {canDelete && (
            <button className={styles.btnDanger} onClick={handleDelete}>
              Delete
            </button>
          )}
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
          {!isUnassignedMember && (
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
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

          {isUnassignedMember ? (
            <p className={styles.emptyText} style={{ marginTop: 8 }}>
              You're not assigned to this task, so you can't comment on it.
            </p>
          ) : (
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
          )}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {(a.file_size / 1024).toFixed(0)} KB
                    </span>
                    {canDeleteAttachment(a) && (
                      <button
                        onClick={() => handleDeleteAttachment(a)}
                        style={{ background: 'none', border: 'none', color: 'var(--priority-high)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isUnassignedMember ? (
            <p className={styles.emptyText} style={{ marginTop: 8 }}>
              You're not assigned to this task, so you can't upload files to it.
            </p>
          ) : (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} disabled={uploading} />
              {uploading && <p className={styles.emptyText}>Uploading…</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
