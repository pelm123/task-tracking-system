import { useState } from 'react';
import styles from './modal.module.css';

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
            <input id="pName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="pDescription">Description</label>
            <textarea
              id="pDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
