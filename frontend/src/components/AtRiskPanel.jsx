import { useEffect, useState } from 'react';
import { getTaskRisk } from '../api/tasks';
import RiskBadge from './RiskBadge';
import { t as tr, getLocale } from '../i18n';

// Dashboard widget: the highest-risk open tasks across all projects.
export default function AtRiskPanel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTaskRisk()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ items: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  const top = data.items
    .filter((i) => i.level === 'high' || i.level === 'medium')
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return (
    <section style={{ margin: '16px 0', padding: 16, border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>⚠ {tr('risk.title')}</h2>
      <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
        {tr('risk.subtitle')}{' '}
        {data.medianDays != null
          ? tr('risk.basedOn', { days: Math.round(data.medianDays * 10) / 10, n: data.historyCount })
          : tr('risk.basedOnDefault', { days: 3 })}
      </p>
      {top.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{tr('risk.empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {top.map((i) => (
            <li key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <RiskBadge risk={i} />
              <strong style={{ flex: 1, minWidth: 160 }}>{i.title}</strong>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {i.project_name}
                {i.due_date ? ` · ${new Date(i.due_date).toLocaleDateString(getLocale())}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
