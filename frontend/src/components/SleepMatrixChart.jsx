/**
 * SleepMatrixChart — One row per night showing sleep stage composition.
 * Uses confirmed WHOOP fields: sleep_duration_ms, sleep_rem_ms, sleep_slow_wave,
 * sleep_awake_ms, sleep_performance, respiratory_rate, disturbances.
 *
 * Each row: date | stage strip | score | resp rate | disturbances
 */
import { msToHHMM, shortDate } from '../utils/format'

const STAGES = [
  { key: 'sleep_slow_wave', label: 'Deep',  color: '#6366f1' },
  { key: 'sleep_rem_ms',    label: 'REM',   color: '#818cf8' },
  { key: 'light',          label: 'Light', color: '#334155' },
  { key: 'sleep_awake_ms', label: 'Awake', color: 'var(--border)' },
]

export default function SleepMatrixChart({ daily = [], count = 14 }) {
  const nights = daily.filter(d => d.sleep_duration_ms).slice(-count)

  if (!nights.length) {
    return <EmptyState message="No sleep data available for this period." />
  }

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Sleep Pattern Matrix</span>
        <span style={subtitle}>Stage composition · last {count} nights with data</span>
      </div>

      <div className="sleep-scroll">
      <div className="sleep-scroll-inner">

      {/* Column headers */}
      <div style={{ ...rowLayout, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span style={colDate}>Date</span>
        <span style={colDur}>Duration</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            {STAGES.map(s => <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />{s.label}
            </span>)}
          </div>
        </div>
        <span style={colStat}>Score</span>
        <span style={colStat}>Resp</span>
        <span style={colStat}>Dist.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {nights.map(d => {
          const total = d.sleep_duration_ms || 1
          const deep  = d.sleep_slow_wave   || 0
          const rem   = d.sleep_rem_ms      || 0
          const awake = d.sleep_awake_ms    || 0
          const light = Math.max(0, total - deep - rem - awake)

          const pct = (ms) => total > 0 ? Math.max(0, Math.round(ms / total * 100)) : 0

          const scoreColor = d.sleep_performance >= 70 ? 'var(--good)'
            : d.sleep_performance >= 50 ? 'var(--warn)' : 'var(--bad)'

          return (
            <div key={d.date} style={{ ...rowLayout, padding: '7px 0' }}>
              <span style={{ ...colDate, fontSize: 11 }}>{shortDate(d.date)}</span>
              <span style={{ ...colDur, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 12 }}>
                {msToHHMM(d.sleep_duration_ms)}
              </span>
              <div style={{ flex: 1 }}>
                {/* Stage bar */}
                <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 10, gap: 1 }}>
                  {[
                    { ms: deep,  color: '#6366f1' },
                    { ms: rem,   color: '#818cf8' },
                    { ms: light, color: '#334155' },
                    { ms: awake, color: 'var(--border)' },
                  ].filter(s => s.ms > 0).map((s, i) => (
                    <div key={i} style={{ width: `${pct(s.ms)}%`, minWidth: s.ms > 0 ? 2 : 0, background: s.color, borderRadius: 2 }} />
                  ))}
                </div>
                {/* Pct labels */}
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  {[
                    { ms: deep, label: 'D' }, { ms: rem, label: 'R' }, { ms: light, label: 'L' },
                  ].map(s => (
                    <span key={s.label} style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {s.label}:{pct(s.ms)}%
                    </span>
                  ))}
                </div>
              </div>
              <span style={{ ...colStat, color: scoreColor, fontWeight: 700 }}>
                {d.sleep_performance != null ? `${Math.round(d.sleep_performance)}%` : '—'}
              </span>
              <span style={colStat}>
                {d.respiratory_rate != null ? `${d.respiratory_rate.toFixed(1)}` : '—'}
              </span>
              <span style={colStat}>
                {d.disturbances != null ? d.disturbances : '—'}
              </span>
            </div>
          )
        })}
      </div>
      </div>{/* sleep-scroll-inner */}
      </div>{/* sleep-scroll */}
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{message}</div>
}

const titleRow   = { marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title      = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle   = { fontSize: 11, color: 'var(--text-muted)' }
const rowLayout  = { display: 'flex', alignItems: 'center', gap: 12 }
const colDate    = { width: 60, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }
const colDur     = { width: 52, flexShrink: 0, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }
const colStat    = { width: 44, flexShrink: 0, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }
