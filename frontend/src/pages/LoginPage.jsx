import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './auth.module.css';

export default function LoginPage() {
  const { login } = useAuth();
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
      navigate('/board');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authScreen}>
      <div className={styles.brandPanel}>
        <span className={styles.brandMark}>Task Tracker</span>
        <div className={styles.brandBody}>
          <div className={styles.brandBars}>
            <div className={styles.brandBar} style={{ height: '45%', background: 'var(--status-todo)' }} />
            <div className={styles.brandBar} style={{ height: '70%', background: 'var(--status-in-progress)' }} />
            <div className={styles.brandBar} style={{ height: '55%', background: 'var(--status-review)' }} />
            <div className={styles.brandBar} style={{ height: '100%', background: 'var(--status-done)' }} />
          </div>
          <h2 className={styles.brandHeadline}>Everything your team is working on, in one board.</h2>
          <p className={styles.brandSub}>
            Tasks, due dates, comments, and who's doing what — kept in sync across your whole team.
          </p>
        </div>
        <span className={styles.brandFoot}>To Do · In Progress · Review · Done</span>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.authCard}>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to see what's on your board.</p>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
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
              <label htmlFor="password">Password</label>
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.switchLine}>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
