import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import * as lineApi from '../api/line';
import styles from './profile.module.css';

const ROLE_LABELS = { admin: 'Admin', pm: 'Project manager', member: 'Team member' };

const NOTIFICATION_TYPE_LABELS = [
  { key: 'assigned', label: "You're assigned to a task" },
  { key: 'status_change', label: "A task you're on changes status" },
  { key: 'comment', label: 'Someone comments on your task' },
  { key: 'due_soon', label: 'A task is due soon (your reminder setting)' },
  { key: 'approved', label: 'Your task is approved' },
  { key: 'approval_denied', label: 'Your task is sent back for changes' },
];

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
      setPrefError('Could not save that setting.');
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
      setNameMsg('Saved.');
    } catch (err) {
      setNameError(err.response?.data?.message || 'Could not update name.');
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
      setPwMsg('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Could not change password.');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleUnlinkLine() {
    if (!window.confirm('Unlink your LINE account? You will stop getting LINE notifications.')) return;
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
              {user?.email} · {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Name</h2>
          <form onSubmit={handleNameSubmit}>
            <div className={styles.field}>
              <label htmlFor="profileName">Display name</label>
              <input id="profileName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {nameError && <p className={styles.errorText}>{nameError}</p>}
            {nameMsg && <p className={styles.successText}>{nameMsg}</p>}
            <button type="submit" className="btn btn-primary" disabled={nameSaving}>
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Password</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div className={styles.field}>
              <label htmlFor="currentPw">Current password</label>
              <input
                id="currentPw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="newPw">New password</label>
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
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>LINE notifications</h2>
          {lineLoading ? (
            <p className={styles.lineHint}>Loading…</p>
          ) : lineStatus?.linked ? (
            <div>
              <p className={styles.lineLinked}>✓ Your LINE account is linked.</p>

              <p className={styles.lineHint}>Choose which of these send you a LINE message:</p>
              {linePrefs ? (
                <div className={styles.prefList}>
                  {NOTIFICATION_TYPE_LABELS.map(({ key, label }) => (
                    <label key={key} className={styles.prefRow}>
                      <input
                        type="checkbox"
                        checked={linePrefs[key] !== false}
                        onChange={() => handleTogglePref(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.lineHint}>Loading preferences…</p>
              )}
              {prefError && <p className={styles.errorText}>{prefError}</p>}

              <button className="btn btn-danger" onClick={handleUnlinkLine}>
                Unlink LINE
              </button>
            </div>
          ) : (
            <div>
              <p className={styles.lineHint}>
                Add our LINE Official Account as a friend, then send this code as a message to link your
                account:
              </p>
              <div className={styles.linkCode}>{lineStatus?.code}</div>
              <p className={styles.lineNote}>
                Once linked, you'll get LINE messages when you're assigned a task, a task's status
                changes, someone comments, or a due date is approaching.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
