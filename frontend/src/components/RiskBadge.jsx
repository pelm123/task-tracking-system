import { t as tr } from '../i18n';

const COLORS = { high: 'var(--priority-high)', medium: 'var(--priority-medium)' };

// Shows only medium / high risk; low risk stays quiet so the board isn't noisy.
export default function RiskBadge({ risk }) {
  if (!risk || !COLORS[risk.level]) return null;
  const level = tr(`risk.level.${risk.level}`);
  const reasons = (risk.reasons || []).map((r) => `• ${tr(`risk.reason.${r.code}`, r.params)}`).join('\n');
  return (
    <span
      title={`${tr('risk.badge', { level })}\n${reasons}`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        cursor: 'help',
        color: COLORS[risk.level],
        border: `1px solid ${COLORS[risk.level]}`,
      }}
    >
      ⚠ {level}
    </span>
  );
}
