import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import AuthToggles from '../components/AuthToggles';
import styles from './auth.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || t('auth.loginFail'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authScreen}>
      <AuthToggles />
      <div className={styles.brandPanel}>
        <span className={styles.brandMark}>{t('auth.brand')}</span>
        <div className={styles.brandBody}>
          <div className={styles.brandBars}>
            <div className={styles.brandBar} style={{ height: '45%', background: 'var(--status-todo)' }} />
            <div className={styles.brandBar} style={{ height: '70%', background: 'var(--status-in-progress)' }} />
            <div className={styles.brandBar} style={{ height: '55%', background: 'var(--status-review)' }} />
            <div className={styles.brandBar} style={{ height: '100%', background: 'var(--status-done)' }} />
          </div>
          <h2 className={styles.brandHeadline}>{t('auth.loginHeadline')}</h2>
          <p className={styles.brandSub}>{t('auth.loginSub')}</p>
        </div>
        <span className={styles.brandFoot}>{t('auth.footStatuses')}</span>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.authCard}>
          <h1>{t('auth.welcomeBack')}</h1>
          <p className="sub">{t('auth.loginIntro')}</p>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <p className={styles.switchLine}>
            {t('auth.newHere')} <Link to="/register">{t('auth.createAccountLink')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
