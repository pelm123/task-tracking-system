import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import * as lineApi from '../api/line';
import { t } from '../i18n';
import styles from './profile.module.css';

const NOTIFICATION_TYPE_KEYS = ['assigned', 'status_change', 'comment', 'due_soon', 'overdue', 'approved', 'approval_denied'];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [nameError, setNameError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const [lineStatus, setLineStatus] = useState(null);
  const [lineLoading, setLineLoading] = useState(true);
  const [linePrefs, setLinePrefs] = useState(null);
  const [prefError, setPrefError] = useState('');

  useEffect(() => {
    lineApi
      .getLinkCode()
      .then(setLineStatus)
      .catch(() => {})
      .finally(() => setLineLoading(false));
  }, []);

  useEffect(() => {
    if (!lineStatus?.linked) return;
    lineApi
      .getNotificationPreferences()
      .then(setLinePrefs)
      .catch(() => {});
  }, [lineStatus?.linked]);

  async function handleTogglePref(key) {
    const next = { ...linePrefs, [key]: !linePrefs[key] };
    setLinePrefs(next); // optimistic
    setPrefError('');
    try {
      await lineApi.updateNotificationPreferences({ [key]: next[key] });
    } catch (err) {
      setLinePrefs(linePrefs); // revert
      setPrefError(t('profile.prefFail'));
    }
  }

  async function handleNameSubmit(e) {
    e.preventDefault();
    setNameError('');
    setNameMsg('');
    setNameSaving(true);
    try {
      const updated = await authApi.updateProfile(name);
      updateUser({ name: updated.name });
      setNameMsg(t('profile.saved'));
    } catch (err) {
      setNameError(err.response?.data?.message || t('profile.nameFail'));
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    setPwSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPwMsg(t('profile.pwUpdated'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwError(err.response?.data?.message || t('profile.pwFail'));
    } finally {
      setPwSaving(false);
    }
  }

  async function handleUnlinkLine() {
    if (!window.confirm(t('profile.unlinkConfirm'))) return;
    await lineApi.unlinkLine();
    const fresh = await lineApi.getLinkCode();
    setLineStatus(fresh);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.identity}>
          <span className={styles.avatar}>{(user?.name || '?').charAt(0).toUpperCase()}</span>
          <div>
            <h1 className={styles.identityName}>{user?.name}</h1>
            <p className={styles.identityMeta}>
              {user?.email} · {t(`profile.role_${user?.role}`)}
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('auth.name')}</h2>
          <form onSubmit={handleNameSubmit}>
            <div className={styles.field}>
              <label htmlFor="profileName">{t('profile.displayName')}</label>
              <input id="profileName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {nameError && <p className={styles.errorText}>{nameError}</p>}
            {nameMsg && <p className={styles.successText}>{nameMsg}</p>}
            <button type="submit" className="btn btn-primary" disabled={nameSaving}>
              {nameSaving ? t('modal.saving') : t('profile.saveName')}
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('auth.password')}</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div className={styles.field}>
              <label htmlFor="currentPw">{t('profile.currentPw')}</label>
              <input
                id="currentPw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="newPw">{t('profile.newPw')}</label>
              <input
                id="newPw"
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            {pwError && <p className={styles.errorText}>{pwError}</p>}
            {pwMsg && <p className={styles.successText}>{pwMsg}</p>}
            <button type="submit" className="btn btn-primary" disabled={pwSaving}>
              {pwSaving ? t('profile.updating') : t('profile.updatePw')}
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('profile.lineTitle')}</h2>
          {lineLoading ? (
            <p className={styles.lineHint}>{t('common.loading')}</p>
          ) : lineStatus?.linked ? (
            <div>
              <p className={styles.lineLinked}>{t('profile.lineLinked')}</p>

              <p className={styles.lineHint}>{t('profile.linePrefsIntro')}</p>
              {linePrefs ? (
                <div className={styles.prefList}>
                  {NOTIFICATION_TYPE_KEYS.map((key) => (
                    <label key={key} className={styles.prefRow}>
                      <input
                        type="checkbox"
                        checked={linePrefs[key] !== false}
                        onChange={() => handleTogglePref(key)}
                      />
                      {t(`profile.pref_${key}`)}
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.lineHint}>{t('profile.loadingPrefs')}</p>
              )}
              {prefError && <p className={styles.errorText}>{prefError}</p>}

              <button className="btn btn-danger" onClick={handleUnlinkLine}>
                {t('profile.unlink')}
              </button>
            </div>
          ) : (
            <div>
              <p className={styles.lineHint}>{t('profile.lineAddFriend')}</p>
              <div className={styles.linkCode}>{lineStatus?.code}</div>
              <p className={styles.lineNote}>{t('profile.lineNote')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
