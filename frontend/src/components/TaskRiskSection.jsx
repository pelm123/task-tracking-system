import { useEffect, useState } from 'react';
import { getTaskRiskExplain } from '../api/tasks';
import { t as tr } from '../i18n';
import modalStyles from './modal.module.css';

const COLORS = { high: 'var(--priority-high)', medium: 'var(--priority-medium)' };

// Shows why a task is flagged (rule-based) and, on request, an AI-written
// explanation. Renders nothing for done or low-risk tasks.
export default function TaskRiskSection({ taskId, status, dueDate }) {
  const [data, setData] = useState(null);
  const [asking, setAsking] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setAiFailed(false);
    getTaskRiskExplain(taskId)
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskId, status, dueDate]);

  async function askAi() {
    setAsking(true);
    setAiFailed(false);
    try {
      const d = await getTaskRiskExplain(taskId, true);
      setData(d);
      if (!d.explanation) setAiFailed(true);
    } catch (err) {
      setAiFailed(true);
    } finally {
      setAsking(false);
    }
  }

  const risk = data?.risk;
  if (!risk || !COLORS[risk.level]) return null;

  return (
    <div className={modalStyles.section}>
      <p className={modalStyles.sectionTitle}>⚠ {tr('risk.detailTitle')}</p>
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: COLORS[risk.level] }}>
        {tr(`risk.level.${risk.level}`)}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {risk.reasons.map((r) => (
          <li key={r.code}>{tr(`risk.reason.${r.code}`, r.params)}</li>
        ))}
      </ul>

      {data.aiEnabled && !data.explanation && (
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={askAi} disabled={asking}>
          {asking ? tr('risk.aiThinking') : `✨ ${tr('risk.aiAsk')}`}
        </button>
      )}
      {aiFailed && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>{tr('risk.aiFail')}</p>
      )}
      {data.explanation && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--color-accent-soft)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {data.explanation.text}
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
            ✨ {tr('risk.aiLabel')}
          </div>
        </div>
      )}
    </div>
  );
}
