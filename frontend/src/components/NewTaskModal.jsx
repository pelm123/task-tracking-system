import { useRef, useState } from 'react';
import styles from './modal.module.css';
import {
  REMINDER_PRESETS,
  DEFAULT_REMINDER_HOURS,
  DEFAULT_DUE_TIME,
  dateInputToDueTimestamp,
} from '../utils/dueDate';

export default function NewTaskModal({ users, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState(DEFAULT_DUE_TIME);
  const [reminderHours, setReminderHours] = useState(DEFAULT_REMINDER_HOURS);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // `saving` is state, so it isn't updated until the next render — two quick
  // submits (double-click, or Enter then click) can both get through. A ref
  // flips immediately and blocks the second one.
  const submittingRef = useRef(false);

  function toggleAssignee(userId) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? dateInputToDueTimestamp(dueDate, dueTime) : undefined,
        reminder_hours_before: dueDate ? reminderHours : undefined,
        assignee_ids: assigneeIds,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create task');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>New task</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="dueDate">Due date</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {dueDate && (
              <div className={styles.field}>
                <label htmlFor="dueTime">Due time</label>
                <input
                  id="dueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {dueDate && (
            <div className={styles.field}>
              <label htmlFor="reminderHours">Remind me</label>
              <select
                id="reminderHours"
                value={reminderHours}
                onChange={(e) => setReminderHours(Number(e.target.value))}
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
                  />
                  <span className={styles.assigneeName}>
                    {u.name} <span className={styles.assigneeRole}>({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
