import { useLang } from '../context/LanguageContext';
import { checkPassword, PASSWORD_MIN_LENGTH } from '../utils/passwordPolicy';
import styles from './passwordRequirements.module.css';

// Live checklist of the password rules, plus whether the confirmation matches
// (left out when no `confirm` is given, e.g. the admin's reset dialog).
// Shown under the password fields on sign-up, the profile page and admin reset.
export default function PasswordRequirements({ password, confirm, email, name }) {
  const { t } = useLang();
  const rules = checkPassword(password, { email, name });
  const hasConfirm = typeof confirm === 'string';
  const confirmTyped = hasConfirm && confirm.length > 0;
  const matches = confirmTyped && password === confirm;

  return (
    <ul className={styles.list} aria-live="polite">
      {rules.map((rule) => (
        <li key={rule.key} className={rule.ok ? styles.ok : styles.todo}>
          <span aria-hidden="true">{rule.ok ? '✓' : '•'}</span>
          {t(`password.${rule.key}`, { min: PASSWORD_MIN_LENGTH })}
        </li>
      ))}
      {hasConfirm && (
        <li className={matches ? styles.ok : confirmTyped ? styles.bad : styles.todo}>
          <span aria-hidden="true">{matches ? '✓' : confirmTyped ? '✕' : '•'}</span>
          {confirmTyped && !matches ? t('password.mismatch') : t('password.ruleMatch')}
        </li>
      )}
    </ul>
  );
}
