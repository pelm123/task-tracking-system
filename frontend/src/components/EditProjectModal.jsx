import { useState } from 'react';
import { colorForProject } from '../utils/projectColor';
import { t } from '../i18n';
import styles from './modal.module.css';

const MAX_NAME_LENGTH = 500; // keep in sync with the backend / projects.name

// the same curated colors new projects are given automatically
const SWATCHES = [
  '#4C8DFF', '#F0A93B', '#3FBF7F', '#E255A1', '#8E7CFF', '#25B7C9',
  '#B6CB3B', '#D14DDB', '#B58863', '#7C93A8', '#FF8FA3', '#C4A7E7',
];

export default function EditProjectModal({ project, onClose, onSave }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState((project.color || colorForProject(project.id)).toUpperCase());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('modal.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(project.id, {
        name: name.trim(),
        description: description.trim(),
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t('modal.saveProjectFail'));
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{t('modal.editProject')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="epName">{t('modal.name')}</label>
            <input
              id="epName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="epDescription">{t('modal.description')}</label>
            <textarea
              id="epDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modal.projectDescPlaceholder')}
            />
          </div>

          <div className={styles.field}>
            <label>{t('modal.color')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={t('modal.useColor', { color: c })}
                  onClick={() => setColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border: color === c ? '3px solid var(--color-text)' : '2px solid transparent',
                    outline: 'none',
                    padding: 0,
                  }}
                />
              ))}
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4c8dff'}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                title={t('modal.pickColor')}
                style={{ width: 32, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </div>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? t('modal.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
