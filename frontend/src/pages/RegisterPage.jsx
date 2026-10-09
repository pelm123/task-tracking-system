import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import styles from './auth.module.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState(null); // set once the account is created

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, role);
      setSubmittedEmail(email);
    } catch (err) {
      setError(err.response?.data?.message || t('auth.registerFail'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authScreen}>
      <LanguageToggle />
      <div className={styles.brandPanel}>
        <span className={styles.brandMark}>{t('auth.brand')}</span>
        <div className={styles.brandBody}>
          <div className={styles.brandBars}>
            <div className={styles.brandBar} style={{ height: '100%', background: 'var(--status-done)' }} />
            <div className={styles.brandBar} style={{ height: '55%', background: 'var(--status-review)' }} />
            <div className={styles.brandBar} style={{ height: '70%', background: 'var(--status-in-progress)' }} />
            <div className={styles.brandBar} style={{ height: '45%', background: 'var(--status-todo)' }} />
          </div>
          <h2 className={styles.brandHeadline}>{t('auth.registerHeadline')}</h2>
          <p className={styles.brandSub}>{t('auth.registerSub')}</p>
        </div>
        <span className={styles.brandFoot}>{t('auth.footStatuses')}</span>
      </div>

      <div className={styles.formPanel}>
      {submittedEmail ? (
        <div className={styles.authCard}>
          <div className={styles.pendingIcon}>⏳</div>
          <h1>{t('auth.waitingTitle')}</h1>
          <p className="sub">{t('auth.waitingBody', { email: submittedEmail })}</p>
          <p className={styles.pendingNote}>{t('auth.waitingNote')}</p>
          <button type="button" className={styles.submitBtn} onClick={() => navigate('/login')}>
            {t('auth.backToSignIn')}
          </button>
        </div>
      ) : (
      <div className={styles.authCard}>
        <h1>{t('auth.createYourAccount')}</h1>
        <p className="sub">{t('auth.registerIntro')}</p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="name">{t('auth.name')}</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="role">{t('auth.role')}</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">{t('auth.roleMember')}</option>
              <option value="pm">{t('auth.rolePm')}</option>
            </select>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </button>
        </form>

        <p className={styles.switchLine}>
          {t('auth.haveAccount')} <Link to="/login">{t('auth.signIn')}</Link>
        </p>
      </div>
      )}
      </div>
    </div>
  );
}
