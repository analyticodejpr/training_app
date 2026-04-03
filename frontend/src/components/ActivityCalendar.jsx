import { recoveryColor, activityIcon, shortDate } from '../utils/format'

// Build a 10-week grid of days
function buildGrid(weeks = 10) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = (weeks * 7) - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ActivityCalendar({ whoopDaily = [], stravaActivities = [] }) {
  const weeks = 10
  const days  = buildGrid(weeks)

  // Index data by date string
  const recoveryByDate = {}
  for (const d of whoopDaily) recoveryByDate[d.date] = d

  const activitiesByDate = {}
  for (const a of stravaActivities) {
    const date = a.start_date_local?.split('T')[0] || a.start_date?.split('T')[0]
    if (!date) continue
    if (!activitiesByDate[date]) activitiesByDate[date] = []
    activitiesByDate[date].push(a)
  }

  // Split into weeks (rows of 7)
  const grid = []
  for (let w = 0; w < weeks; w++) {
    grid.push(days.slice(w * 7, w * 7 + 7))
  }

  return (
    <div>
      <h3 style={sectionTitle}>Training + Recovery Calendar</h3>

      {/* Day labels */}
      <div style={dayLabelRow}>
        {WEEK_LABELS.map(l => (
          <div key={l} style={dayLabelCell}>{l}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={gridWrapper}>
        {grid.map((week, wi) => (
          <div key={wi} style={weekRow}>
            {week.map(date => {
              const rec  = recoveryByDate[date]
              const acts = activitiesByDate[date] || []
              const bg   = rec?.recovery_score != null
                ? `${recoveryColor(rec.recovery_score)}22`
                : 'var(--surface-2)'
              const borderColor = rec?.recovery_score != null
                ? `${recoveryColor(rec.recovery_score)}55`
                : 'var(--border)'
              const isToday = date === new Date().toISOString().split('T')[0]

              return (
                <div key={date} title={buildTooltip(date, rec, acts)}
                  style={{
                    ...dayCell,
                    background: bg,
                    border: `1px solid ${isToday ? 'var(--accent)' : borderColor}`,
                    outline: isToday ? '2px solid var(--accent)' : 'none',
                  }}>
                  <span style={dayNumber}>{new Date(date + 'T12:00:00').getDate()}</span>
                  {rec?.recovery_score != null && (
                    <span style={{ ...recoveryBadge, color: recoveryColor(rec.recovery_score) }}>
                      {Math.round(rec.recovery_score)}
                    </span>
                  )}
                  {acts.slice(0, 2).map((a, i) => (
                    <span key={i} style={actBadge} title={a.name}>{activityIcon(a.type)}</span>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={legend}>
        <span style={{ color: 'var(--good)' }}>■</span> High recovery (67–100)&nbsp;
        <span style={{ color: 'var(--warn)' }}>■</span> Moderate (34–66)&nbsp;
        <span style={{ color: 'var(--bad)' }}>■</span> Low (&lt;34)&nbsp;
        <span style={{ color: 'var(--accent)' }}>■</span> Today
      </div>
    </div>
  )
}

function buildTooltip(date, rec, acts) {
  const lines = [shortDate(date)]
  if (rec?.recovery_score != null) lines.push(`Recovery: ${Math.round(rec.recovery_score)}%`)
  if (rec?.hrv_rmssd != null)      lines.push(`HRV: ${Math.round(rec.hrv_rmssd)} ms`)
  if (rec?.resting_hr != null)     lines.push(`RHR: ${Math.round(rec.resting_hr)} bpm`)
  if (acts.length) lines.push(`Activities: ${acts.map(a => a.name || a.type).join(', ')}`)
  return lines.join('\n')
}

const sectionTitle = {
  fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
}

const gridWrapper = { display: 'flex', flexDirection: 'column', gap: 3 }

const weekRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 3,
}

const dayLabelRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 3,
  marginBottom: 4,
}

const dayLabelCell = {
  textAlign: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const dayCell = {
  borderRadius: 6,
  padding: '6px 5px 5px',
  minHeight: 60,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  cursor: 'default',
  transition: 'transform 0.1s',
}

const dayNumber = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  lineHeight: 1,
}

const recoveryBadge = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1,
}

const actBadge = {
  fontSize: 13,
  lineHeight: 1,
}

const legend = {
  marginTop: 10,
  fontSize: 11,
  color: 'var(--text-muted)',
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
}
