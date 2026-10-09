import { useState } from 'react';
import styles from './modal.module.css';

const MAX_NAME_LENGTH = 500; // keep in sync with the backend / projects.name

export default function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>New project</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="pName">Name</label>
            <input
              id="pName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
            />
            {name.length > MAX_NAME_LENGTH * 0.8 && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block', textAlign: 'right' }}>
                {name.length}/{MAX_NAME_LENGTH}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="pDescription">Description</label>
            <textarea
              id="pDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what's this project for?"
            />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
