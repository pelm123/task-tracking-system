import { useRef, useState } from 'react';
import { t } from '../i18n';
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
      setError(t('modal.titleRequired'));
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
      setError(err.response?.data?.message || t('modal.createTaskFail'));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{t('board.newTask')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="title">{t('modal.title')}</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="description">{t('modal.description')}</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="priority">{t('list.priority')}</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="dueDate">{t('modal.dueDate')}</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {dueDate && (
              <div className={styles.field}>
                <label htmlFor="dueTime">{t('modal.dueTime')}</label>
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
              <label htmlFor="reminderHours">{t('modal.remindMe')}</label>
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
              {t('modal.assignTo')}
              {assigneeIds.length > 0 && ` (${t('board.selected', { n: assigneeIds.length })})`}
            </label>
            <div className={styles.assigneeList}>
              {users.length === 0 && <p className={styles.emptyText}>{t('modal.noUsers')}</p>}
              {users.map((u) => (
                <label key={u.id} className={styles.assigneeRow}>
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(u.id)}
                    onChange={() => toggleAssignee(u.id)}
                  />
                  <span className={styles.assigneeName}>
                    {u.name} <span className={styles.assigneeRole}>({t(`roles.${u.role}`)})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? t('modal.creating') : t('modal.createTask')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
