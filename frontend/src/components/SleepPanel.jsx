import { msToHHMM, shortDate } from '../utils/format'

export default function SleepPanel({ daily = [], count = 14 }) {
  const recent = daily.filter(d => d.sleep_duration_ms).slice(-count)

  if (!recent.length) {
    return <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No sleep data available.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {recent.map(d => {
        const total   = d.sleep_duration_ms || 0
        const rem     = d.sleep_rem_ms || 0
        const deep    = d.sleep_slow_wave || 0
        const awake   = d.sleep_awake_ms || 0
        const light   = total - rem - deep - awake

        const pct = (ms) => total > 0 ? (ms / total * 100).toFixed(0) : 0

        return (
          <div key={d.date} style={row}>
            <div style={dateCol}>
              <div style={dateLabel}>{shortDate(d.date)}</div>
              <div style={durLabel}>{msToHHMM(total)}</div>
            </div>

            {/* Sleep stage bar */}
            <div style={{ flex: 1 }}>
              <div style={stageBar}>
                {deep  > 0 && <div style={{ ...stageSegment, width: `${pct(deep)}%`,  background: '#6366f1', title: 'Deep' }} />}
                {rem   > 0 && <div style={{ ...stageSegment, width: `${pct(rem)}%`,   background: '#818cf8', title: 'REM' }} />}
                {light > 0 && <div style={{ ...stageSegment, width: `${pct(light)}%`, background: '#334155', title: 'Light' }} />}
                {awake > 0 && <div style={{ ...stageSegment, width: `${pct(awake)}%`, background: 'var(--border)', title: 'Awake' }} />}
              </div>
              <div style={stageLegend}>
                <StageLabel color="#6366f1" label={`Deep ${pct(deep)}%`} />
                <StageLabel color="#818cf8" label={`REM ${pct(rem)}%`} />
                <StageLabel color="#334155" label={`Light ${pct(light)}%`} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
              {d.sleep_performance != null && (
                <Stat label="Score" value={`${Math.round(d.sleep_performance)}%`} color="var(--whoop)" />
              )}
              {d.respiratory_rate != null && (
                <Stat label="Resp" value={`${d.respiratory_rate.toFixed(1)}/min`} />
              )}
              {d.disturbances != null && (
                <Stat label="Dist." value={d.disturbances} />
              )}
            </div>
          </div>
        )
      })}

      <div style={legend}>
        <StageLabel color="#6366f1" label="Deep (SWS)" />
        <StageLabel color="#818cf8" label="REM" />
        <StageLabel color="#334155" label="Light" />
        <StageLabel color="var(--border)" label="Awake" />
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function StageLabel({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

const row = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}

const dateCol = { width: 52, flexShrink: 0 }
const dateLabel = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }
const durLabel  = { fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }

const stageBar = {
  display: 'flex', borderRadius: 4, overflow: 'hidden', height: 10, gap: 1,
}

const stageSegment = {
  height: '100%',
  minWidth: 2,
  borderRadius: 2,
  transition: 'width 0.3s',
}

const stageLegend = {
  display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap',
}

const legend = {
  display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap',
  padding: '8px 0 0',
  borderTop: '1px solid var(--border)',
}
