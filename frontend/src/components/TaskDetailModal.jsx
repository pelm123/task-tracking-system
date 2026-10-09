import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as commentsApi from '../api/comments';
import * as attachmentsApi from '../api/attachments';
import * as tasksApi from '../api/tasks';
import {
  REMINDER_PRESETS,
  DEFAULT_REMINDER_HOURS,
  getDueCountdown,
  toDateInputValue,
  toTimeInputValue,
  dateInputToDueTimestamp,
} from '../utils/dueDate';
import { formatDateTime, timeAgo } from '../utils/dateTime';
import { t, getLocale } from '../i18n';
import styles from './modal.module.css';

const MAX_UPLOAD_MB = 200; // keep in sync with backend middleware/upload.js (UPLOAD_MAX_MB)
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Activity details are stored language-neutral (JSON) so they can be shown in
// whichever language the viewer is using. Older rows, and file names, are
// plain text and shown as they are.
const LEGACY_STATUS = { 'To Do': 'todo', 'In Progress': 'in_progress', Review: 'review', Done: 'done' };
function describeLegacyDetail(detail) {
  // rows written before details became language-neutral, e.g. "To Do → In Progress"
  const m = /^(To Do|In Progress|Review|Done)? ?→ (To Do|In Progress|Review|Done)(?:: ([\s\S]*))?$/.exec(detail);
  if (!m) return detail;
  const to = t(`status.${LEGACY_STATUS[m[2]]}`);
  const move = m[1] ? `${t(`status.${LEGACY_STATUS[m[1]]}`)} → ${to}` : `→ ${to}`;
  return m[3] ? `${move}: ${m[3]}` : move;
}

function describeActivityDetail(detail) {
  let d = null;
  try {
    d = JSON.parse(detail);
  } catch (err) {
    return describeLegacyDetail(detail);
  }
  if (!d || typeof d !== 'object') return detail;

  const status = (s) => (s ? t(`status.${s}`) : '');
  if (Array.isArray(d.changes)) {
    return d.changes
      .map((c) => {
        switch (c.k) {
          case 'title':
            return t('activityDetail.title', { value: c.v });
          case 'priority':
            return t('activityDetail.priority', { value: t(`priority.${c.v}`) });
          case 'due':
            return t('activityDetail.due', { value: formatDateTime(c.v) });
          case 'assignees':
            return t('activityDetail.assignees', {
              value: (c.v || []).join(', ') || t('activityDetail.nobody'),
            });
          case 'description':
          case 'reminder':
            return t(`activityDetail.${c.k}`);
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join('; ');
  }
  if (d.to) {
    const move = d.from ? `${status(d.from)} → ${status(d.to)}` : `→ ${status(d.to)}`;
    return d.reason ? `${move}: ${d.reason}` : move;
  }
  return detail;
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
  // Files (preview AND download): only admin/pm, assignees and the creator.
  // Anyone else can see that files are attached but can't open them. Mirrors
  // the backend check (canOpenFiles in attachment.controller.js).
  const canOpenFiles = !isUnassignedMember;
  // admin/pm can delete any task; a member can delete only a task they
  // created themselves — mirrors the backend check in deleteTask
  const canDelete = canApprove || task.created_by === currentUser.id;

  // A plain member who's on the task can bring in fellow members to help, but
  // can't remove anyone or add a PM/admin — only PM/admin can. Mirrors the
  // backend check (checkMemberAssigneeChange in task.controller.js).
  const isMemberRole = currentUser.role === 'member';
  const originalAssigneeIds = (task.assignees || []).map((a) => a.id);
  function assigneeLockReason(u) {
    if (isUnassignedMember) return t('detail.lockUnassigned');
    if (!isMemberRole) return null;
    if (originalAssigneeIds.includes(u.id)) return t('detail.lockRemove');
    if (u.role !== 'member') return t('detail.lockAddMembers');
    return null;
  }

  function toggleAssignee(userId) {
    const person = users.find((u) => u.id === userId);
    if (person && assigneeLockReason(person)) return;
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
  const [activity, setActivity] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // chosen but not yet saved
  const [preview, setPreview] = useState(null); // { url, mimeType, name }
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Revoke the blob URL whenever the preview closes or the component
  // unmounts with one still open, so we don't leak memory.
  useEffect(() => {
    return () => {
      if (preview) window.URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function loadActivity() {
    tasksApi
      .listTaskActivity(task.id)
      .then(setActivity)
      .catch(() => {}); // the log is informational — never block the modal on it
  }

  // Edits made by anyone (real-time sync bumps updated_at) refresh the log.
  useEffect(() => {
    loadActivity();
  }, [task.updated_at]);

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
    loadActivity();
    setPendingFile(null); // a staged file belongs to the task it was chosen on
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      setError(err.response?.data?.message || t('detail.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('detail.confirmDeleteTask'))) return;
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      setError(t('detail.errDelete'));
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
      setError(t('detail.errPost'));
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
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: updated.content, updated_at: updated.updated_at } : c)));
      setEditingCommentId(null);
    } catch (err) {
      setError(t('detail.errCommentEdit'));
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm(t('detail.confirmDeleteComment'))) return;
    try {
      await commentsApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(t('detail.errCommentDelete'));
    }
  }

  // Choosing a file only stages it; nothing is uploaded until "Save".
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('detail.errTooLarge', { mb: MAX_UPLOAD_MB }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setError('');
    setPendingFile(file);
  }

  function handleCancelUpload() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSaveUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const created = await attachmentsApi.uploadAttachment(task.id, pendingFile);
      setAttachments((prev) => [{ ...created, uploader_name: created.uploader_name || currentUser.name }, ...prev]);
      setPendingFile(null);
      loadActivity();
    } catch (err) {
      // Keep the staged file so the user can retry or cancel.
      setError(err.response?.data?.message || t('detail.errUpload'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(att) {
    if (!canOpenFiles) return;
    try {
      await attachmentsApi.downloadAttachment(att.id, att.file_name);
    } catch (err) {
      setError(t('detail.errDownload'));
    }
  }

  // Clicking an image/PDF's name opens it in the in-app preview modal;
  // anything else just downloads, same as before.
  async function handleOpenAttachment(att) {
    if (!canOpenFiles) {
      setError(t('detail.errOpenFiles'));
      return;
    }
    if (!attachmentsApi.isPreviewable(att.mime_type)) {
      return handleDownload(att);
    }
    setPreviewLoading(true);
    try {
      const url = await attachmentsApi.getPreviewUrl(att.id);
      setPreview({ id: att.id, url, mimeType: att.mime_type, name: att.file_name });
    } catch (err) {
      setError(t('detail.errPreview'));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (preview) window.URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  // Mirrors the backend rule in deleteAttachment: admin/pm can delete any
  // file; a member can delete a file they uploaded themselves, or any file
  // on a task they're assigned to or created.
  function canDeleteAttachment(att) {
    return canApprove || isCreator || isAssignee || att.uploaded_by === currentUser.id;
  }

  async function handleDeleteAttachment(att) {
    if (!window.confirm(t('detail.confirmDeleteFile', { name: att.file_name }))) return;
    try {
      await attachmentsApi.deleteAttachment(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      loadActivity();
    } catch (err) {
      setError(err.response?.data?.message || t('detail.errFileDelete'));
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{t('detail.heading')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {isUnassignedMember && (
          <p className={styles.emptyText} style={{ margin: '0 0 12px' }}>
            {t('detail.viewOnly')}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="dTitle">{t('modal.title')}</label>
          <input
            id="dTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            disabled={isUnassignedMember}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="dDescription">{t('modal.description')}</label>
          <textarea
            id="dDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUnassignedMember}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="dPriority">{t('list.priority')}</label>
            <select
              id="dPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isUnassignedMember}
            >
              <option value="low">{t('priority.low')}</option>
              <option value="medium">{t('priority.medium')}</option>
              <option value="high">{t('priority.high')}</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="dDueDate">{t('modal.dueDate')}</label>
            <input
              id="dDueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canReschedule}
              title={canReschedule ? undefined : t('detail.lockReschedule')}
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
                {t('detail.cantReschedule')}
              </p>
            )}
          </div>

          {dueDate && (
            <div className={styles.field}>
              <label htmlFor="dDueTime">{t('modal.dueTime')}</label>
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
              <label htmlFor="dReminder">{t('modal.remindMe')}</label>
              <select
                id="dReminder"
                value={reminderHours}
                onChange={(e) => setReminderHours(Number(e.target.value))}
                disabled={!canReschedule}
                title={canReschedule ? undefined : t('detail.lockReminder')}
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
              {t('modal.assignTo')}
              {assigneeIds.length > 0 && ` (${t('board.selected', { n: assigneeIds.length })})`}
            </label>
            <div className={styles.assigneeList}>
              {users.length === 0 && <p className={styles.emptyText}>{t('modal.noUsers')}</p>}
              {users.map((u) => (
                <label
                  key={u.id}
                  className={styles.assigneeRow}
                  title={assigneeLockReason(u) || undefined}
                  style={assigneeLockReason(u) ? { opacity: 0.6 } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(u.id)}
                    onChange={() => toggleAssignee(u.id)}
                    disabled={Boolean(assigneeLockReason(u))}
                  />
                  <span className={styles.assigneeName}>
                    {u.name} <span className={styles.assigneeRole}>({t(`roles.${u.role}`)})</span>
                  </span>
                </label>
              ))}
            </div>
            {isUnassignedMember && (
              <p className={styles.emptyText} style={{ marginTop: 4 }}>
                {t('detail.assignFirst')}
              </p>
            )}
            {isMemberRole && !isUnassignedMember && (
              <p className={styles.emptyText} style={{ marginTop: 4 }}>
                {t('detail.memberHint')}
              </p>
            )}
          </div>
        </div>

        {task.status === 'review' && (
          <p className={styles.emptyText} style={{ margin: '0 0 12px' }}>
            {canApprove
              ? t('detail.awaitingYou')
              : t('detail.inReview')}
          </p>
        )}

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          {canDelete && (
            <button className={styles.btnDanger} onClick={handleDelete}>
              {t('common.delete')}
            </button>
          )}
          {task.status === 'done' && canApprove && (
            <button className={styles.btnDanger} onClick={() => onDeny(task.id)}>
              {t('detail.reopenBtn')}
            </button>
          )}
          {task.status === 'review' && canApprove && (
            <>
              <button
                className={styles.btnDanger}
                onClick={() => onDeny(task.id)}
              >
                {t('detail.denyBtn')}
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => onApprove(task.id)}
              >
                {t('detail.approveBtn')}
              </button>
            </>
          )}
          {!isUnassignedMember && (
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('modal.saving') : t('detail.saveChanges')}
            </button>
          )}
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('detail.comments')}</p>

          {loadingComments ? (
            <p className={styles.emptyText}>{t('common.loading')}</p>
          ) : comments.length === 0 ? (
            <p className={styles.emptyText}>{t('detail.noComments')}</p>
          ) : (
            <div className={styles.commentList}>
              {comments.map((c) => (
                <div key={c.id} className={styles.commentItem}>
                  <div className={styles.commentMeta}>
                    <span>
                      {c.author_name}
                      <span className={styles.stamp} title={new Date(c.created_at).toLocaleString(getLocale())}>
                        {formatDateTime(c.created_at)} · {timeAgo(c.created_at)}
                      </span>
                      {c.updated_at && (
                        <span className={styles.editedStamp} title={new Date(c.updated_at).toLocaleString(getLocale())}>
                          {t('detail.editedBy', { date: formatDateTime(c.updated_at), name: c.author_name })}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.user_id === currentUser.id && editingCommentId !== c.id && (
                        <>
                          <button
                            onClick={() => startEditingComment(c)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--priority-high)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                          >
                            {t('common.delete')}
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
                        {t('common.save')}
                      </button>
                      <button className={styles.btnGhost} onClick={() => setEditingCommentId(null)}>
                        {t('common.cancel')}
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
              {t('detail.cantComment')}
            </p>
          ) : (
            <form className={styles.commentForm} onSubmit={handleAddComment}>
              <input
                placeholder={t('detail.commentPlaceholder')}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
              />
              <button type="submit" className={styles.btnPrimary}>
                {t('detail.post')}
              </button>
            </form>
          )}
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('detail.attachments')}</p>

          {attachments.length === 0 ? (
            <p className={styles.emptyText}>{t('detail.noFiles')}</p>
          ) : (
            <div className={styles.attachmentList}>
              {attachments.map((a) => {
                const previewable = attachmentsApi.isPreviewable(a.mime_type);
                return (
                  <div key={a.id} className={styles.attachmentItem}>
                    <button
                      className={styles.attachmentName}
                      onClick={() => handleOpenAttachment(a)}
                      disabled={!canOpenFiles}
                      style={canOpenFiles ? undefined : { cursor: 'not-allowed', opacity: 0.7, textDecoration: 'none' }}
                      title={
                        !canOpenFiles
                          ? t('detail.fileLocked')
                          : previewable
                            ? t('detail.clickPreview')
                            : t('detail.clickDownload')
                      }
                    >
                      {!canOpenFiles ? (
                        <span aria-hidden="true">🔒 </span>
                      ) : (
                        previewable && <span aria-hidden="true">🖼 </span>
                      )}
                      {a.file_name}
                    </button>
                    <span className={styles.attachStamp} title={new Date(a.created_at).toLocaleString(getLocale())}>
                      {a.uploader_name ? t('detail.addedBy', { name: a.uploader_name }) : t('detail.added')} · {formatDateTime(a.created_at)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {(a.file_size / 1024).toFixed(0)} KB
                      </span>
                      {previewable && canOpenFiles && (
                        <button
                          onClick={() => handleDownload(a)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        >
                          {t('detail.download')}
                        </button>
                      )}
                      {canDeleteAttachment(a) && (
                        <button
                          onClick={() => handleDeleteAttachment(a)}
                          style={{ background: 'none', border: 'none', color: 'var(--priority-high)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {previewLoading && <p className={styles.emptyText}>{t('detail.loadingPreview')}</p>}

          {isUnassignedMember ? (
            <p className={styles.emptyText} style={{ marginTop: 8 }}>
              {t('detail.cantFiles')}
            </p>
          ) : (
            <>
              {/* The native input stays mounted (hidden while a file is staged) so the ref keeps working */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={uploading}
                style={pendingFile ? { display: 'none' } : undefined}
              />
              {pendingFile && (
                <div className={styles.pendingUpload}>
                  <span className={styles.pendingIcon}>📎</span>
                  <div className={styles.pendingInfo}>
                    <span className={styles.pendingName} title={pendingFile.name}>{pendingFile.name}</span>
                    <span className={styles.pendingSize}>
                      {pendingFile.size >= 1024 * 1024
                        ? `${(pendingFile.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.max(1, Math.round(pendingFile.size / 1024))} KB`}
                      {uploading ? ` · ${t('detail.uploading')}` : ` · ${t('detail.notSaved')}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.pendingCancel}
                    onClick={handleCancelUpload}
                    disabled={uploading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className={styles.pendingSave}
                    onClick={handleSaveUpload}
                    disabled={uploading}
                  >
                    {uploading ? t('modal.saving') : t('common.save')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('detail.activity')}</p>
          {activity.length === 0 ? (
            <p className={styles.emptyText}>{t('detail.noActivity')}</p>
          ) : (
            <ul className={styles.activityList}>
              {activity.map((a) => (
                <li key={a.id} className={styles.activityItem}>
                  <span className={styles.activityWhen}>{formatDateTime(a.created_at)}</span>
                  <span className={styles.activityText}>
                    <strong>{a.user_name || t('detail.someone')}</strong>{' '}
                    {t(`activity.${a.action}`) === `activity.${a.action}` ? a.action : t(`activity.${a.action}`)}
                    {a.detail ? <span className={styles.activityDetail}>{describeActivityDetail(a.detail)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {preview && (
        <div
          className={styles.previewOverlay}
          onClick={(e) => {
            e.stopPropagation();
            closePreview();
          }}
        >
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <span className={styles.previewName}>{preview.name}</span>
              <div className={styles.previewActions}>
                <button
                  className={styles.previewDownloadBtn}
                  onClick={() => handleDownload({ id: preview.id, file_name: preview.name })}
                >
                  {t('detail.download')}
                </button>
                <button
                  className={styles.closeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    closePreview();
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.previewBody}>
              {preview.mimeType.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} className={styles.previewImage} />
              ) : (
                <iframe src={preview.url} title={preview.name} className={styles.previewFrame} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
