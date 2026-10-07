import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './auth.module.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, role);
      navigate('/board');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Try again.');
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
            <div className={styles.brandBar} style={{ height: '100%', background: 'var(--status-done)' }} />
            <div className={styles.brandBar} style={{ height: '55%', background: 'var(--status-review)' }} />
            <div className={styles.brandBar} style={{ height: '70%', background: 'var(--status-in-progress)' }} />
            <div className={styles.brandBar} style={{ height: '45%', background: 'var(--status-todo)' }} />
          </div>
          <h2 className={styles.brandHeadline}>Set up your account in a minute.</h2>
          <p className={styles.brandSub}>
            Join your team's project, pick up tasks, and get notified the moment something needs you.
          </p>
        </div>
        <span className={styles.brandFoot}>To Do · In Progress · Review · Done</span>
      </div>

      <div className={styles.formPanel}>
      <div className={styles.authCard}>
        <h1>Create your account</h1>
        <p className="sub">Set up access to the team's board.</p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
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
            <label htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Team member</option>
              <option value="pm">Project manager</option>
            </select>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.switchLine}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
