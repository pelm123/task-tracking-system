import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
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
        <button type="submit" className={styles.submitBtn} disabled={nameSaving} style={{ width: 'auto', padding: '9px 18px' }}>
          {nameSaving ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 14 }}>Change password</h2>
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
        {pwMsg && <p style={{ color: 'var(--status-done)', fontSize: 13, marginTop: -6, marginBottom: 12 }}>{pwMsg}</p>}
        <button type="submit" className={styles.submitBtn} disabled={pwSaving} style={{ width: 'auto', padding: '9px 18px' }}>
          {pwSaving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
