import { recoveryColor } from '../utils/format'

export default function RecoveryGauge({ score, label = 'Recovery' }) {
  const color = recoveryColor(score)
  const pct   = Math.min(100, Math.max(0, score ?? 0))
  const r     = 52
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        {/* Track */}
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
        {/* Progress */}
        <circle
          cx={65} cy={65} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
        {/* Score text */}
        <text x={65} y={60} textAnchor="middle" fill={color}
          style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
          {score != null ? Math.round(score) : '—'}
        </text>
        <text x={65} y={78} textAnchor="middle" fill="var(--text-muted)"
          style={{ fontSize: 11, fontWeight: 500 }}>
          {score != null ? '%' : ''}
        </text>
      </svg>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
    </div>
  )
}
