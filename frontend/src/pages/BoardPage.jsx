import { useAuth } from '../context/AuthContext';

export default function BoardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 32 }}>
      <h1>Board</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Signed in as {user?.name} ({user?.role}). The Kanban board goes here — next step.
      </p>
      <button
        onClick={logout}
        style={{
          marginTop: 16,
          background: 'transparent',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          padding: '8px 14px',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Log out
      </button>
    </div>
  );
}
