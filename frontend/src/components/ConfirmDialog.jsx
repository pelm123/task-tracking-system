import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import styles from './confirmDialog.module.css';

// Generic confirm modal. For a destructive action, pass `requireText` (e.g.
// a short word like "delete") and the Confirm button stays disabled until the user
// types it — a deliberate speed bump for things that can't be undone.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  requireText,
  onConfirm,
  onClose,
}) {
  const { t } = useLang();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Comparison ignores case and surrounding spaces, so a short word like
  // "delete" is easy to confirm.
  const locked = Boolean(requireText) && typed.trim().toLowerCase() !== requireText.toLowerCase();

  async function handleConfirm() {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t('common.somethingWrong'));
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={danger ? styles.titleDanger : styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>

        {requireText && (
          <div className={styles.field}>
            <label>
              {t('confirm.typeBefore')}<strong>{requireText}</strong>{t('confirm.typeAfter')}
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              autoComplete="off"
            />
          </div>
        )}

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className={danger ? styles.btnDanger : styles.btnPrimary}
            onClick={handleConfirm}
            disabled={locked || busy}
          >
            {busy ? t('confirm.working') : confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
