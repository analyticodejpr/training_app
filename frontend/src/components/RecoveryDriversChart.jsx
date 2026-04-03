/**
 * RecoveryDriversChart — Visible, app-defined decomposition of today's recovery.
 * Does NOT replicate WHOOP's proprietary algorithm.
 * Shows signed contributions using confirmed daily fields vs 28-day baselines.
 *
 * Fields used: sleep_performance, hrv_rmssd, resting_hr, strain (yesterday),
 *              respiratory_rate — all from WHOOP daily summary.
 */
import { computeRecoveryDrivers } from '../utils/metrics'
import { recoveryColor } from '../utils/format'

export default function RecoveryDriversChart({ today, prevDay, baseline }) {
  const drivers = computeRecoveryDrivers(today, prevDay, baseline)

  if (!today || !drivers.length) {
    return <EmptyState message="No recovery data available for today." />
  }

  const maxAbs = Math.max(...drivers.map(d => Math.abs(d.contrib)), 1)

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Recovery Drivers</span>
        <span style={subtitle}>
          App-defined heuristic · not WHOOP's algorithm · positive = helps recovery
        </span>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: recoveryColor(today?.recovery_score) }}>
          {today?.recovery_score != null ? `${Math.round(today.recovery_score)}%` : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Recovery score<br />
          <span style={{ fontSize: 10 }}>WHOOP composite (proprietary)</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {drivers.map(d => {
          const pct  = Math.abs(d.contrib) / maxAbs * 100
          const good = d.contrib >= 0
          return (
            <div key={d.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{d.label}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.value}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: good ? 'var(--good)' : 'var(--bad)',
                    minWidth: 48, textAlign: 'right',
                  }}>
                    {d.contrib >= 0 ? '+' : ''}{d.contrib.toFixed(1)}
                  </span>
                </div>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: good ? 'var(--good)' : 'var(--bad)',
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
        Contributions use app-defined weights based on publicly documented correlates of recovery.
        They are illustrative, not authoritative.
      </p>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{message}</div>
}

const titleRow = { marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }
