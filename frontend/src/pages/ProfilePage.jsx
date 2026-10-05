import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import * as lineApi from '../api/line';
import styles from './auth.module.css';

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

  useEffect(() => {
    lineApi
      .getLinkCode()
      .then(setLineStatus)
      .catch(() => {})
      .finally(() => setLineLoading(false));
  }, []);

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
    <div style={{ padding: '28px 32px', maxWidth: 420 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Profile</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 28 }}>
        {user?.email} · {user?.role}
      </p>

      <form onSubmit={handleNameSubmit} style={{ marginBottom: 32 }}>
        <div className={styles.field}>
          <label htmlFor="profileName">Name</label>
          <input id="profileName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {nameError && <p className={styles.errorText}>{nameError}</p>}
        {nameMsg && <p style={{ color: 'var(--status-done)', fontSize: 13, marginTop: -6, marginBottom: 12 }}>{nameMsg}</p>}
        <button type="submit" className="btn btn-primary" disabled={nameSaving}>
          {nameSaving ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 14 }}>Change password</h2>
      <form onSubmit={handlePasswordSubmit} style={{ marginBottom: 32 }}>
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
        {pwMsg && <p style={{ color: 'var(--status-done)', fontSize: 13, marginTop: -6, marginBottom: 12 }}>{pwMsg}</p>}
        <button type="submit" className="btn btn-primary" disabled={pwSaving}>
          {pwSaving ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 14 }}>LINE notifications</h2>
      {lineLoading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</p>
      ) : lineStatus?.linked ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--status-done)', marginBottom: 12 }}>
            ✓ Your LINE account is linked. You'll get task notifications there.
          </p>
          <button className="btn btn-danger" onClick={handleUnlinkLine}>
            Unlink LINE
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Add our LINE Official Account as a friend, then send this code as a message to link your
            account:
          </p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'inline-block',
              marginBottom: 12,
            }}
          >
            {lineStatus?.code}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Once linked, you'll get LINE messages when you're assigned a task, a task's status
            changes, someone comments, or a due date is approaching.
          </p>
        </div>
      )}
    </div>
  );
}
