/**
 * HeatmapCalendar — 10-week grid heatmap.
 * Cell fill = strain intensity (orange gradient).
 * Cell border = recovery zone color (green/yellow/red).
 * Hover tooltip shows date, sport(s), recovery, sleep, strain.
 *
 * Uses: strain, recovery_score, sleep_performance from WHOOP daily;
 *       activity types and names from Strava activities (via dailyGrain).
 */
import { buildDailyGrain } from '../utils/metrics'
import { recoveryColor, shortDate } from '../utils/format'

const WEEKS = 10
const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildGrid() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function strainToAlpha(strain) {
  // Strain 0→21 maps to opacity 0.05→0.85
  if (strain == null) return 0
  return Math.min(0.85, 0.05 + (strain / 21) * 0.80)
}

export default function HeatmapCalendar({ whoopDaily = [], activities = [] }) {
  const allDays = buildGrid()

  const grain = buildDailyGrain(whoopDaily, activities)
  const grainMap = {}
  for (const g of grain) grainMap[g.date] = g

  // Split into 10 weeks
  const grid = []
  for (let w = 0; w < WEEKS; w++) grid.push(allDays.slice(w * 7, w * 7 + 7))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Training + Recovery Calendar</span>
        <span style={subtitle}>Fill = strain · border = recovery zone</span>
      </div>

      {/* Horizontally scrollable on mobile so cells stay readable */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: 320 }}>

      {/* Day labels */}
      <div style={dayLabelRow}>
        {DAYS.map(d => <div key={d} style={dayLabel}>{d}</div>)}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {grid.map((week, wi) => (
          <div key={wi} style={weekRow}>
            {week.map(date => {
              const g    = grainMap[date]
              const rec  = g?.recovery_score
              const str  = g?.strain
              const slp  = g?.sleep_performance
              const acts = g?.activities || []
              const isToday = date === today
              const hasActivity = acts.length > 0

              const bg = str != null
                ? `rgba(252,76,2,${strainToAlpha(str)})`
                : 'var(--surface-2)'
              const borderColor = rec != null ? recoveryColor(rec) : 'var(--border)'
              const borderWidth = rec != null ? 2 : 1

              const tipLines = [
                shortDate(date),
                rec  != null ? `Recovery: ${Math.round(rec)}%` : null,
                str  != null ? `Strain: ${str.toFixed(1)}`     : null,
                slp  != null ? `Sleep: ${Math.round(slp)}%`    : null,
                acts.length  ? `Training: ${acts.map(a => a.type).join(', ')}` : null,
              ].filter(Boolean).join('\n')

              return (
                <div
                  key={date}
                  title={tipLines}
                  style={{
                    borderRadius: 5,
                    padding: '5px 4px 4px',
                    minHeight: 54,
                    background: bg,
                    border: `${borderWidth}px solid ${isToday ? 'var(--accent)' : borderColor}`,
                    outline: isToday ? '2px solid var(--accent)' : undefined,
                    outlineOffset: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'default',
                    transition: 'filter 0.1s',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: str > 14 ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', lineHeight: 1 }}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </span>
                  {rec != null && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, fontWeight: 700, lineHeight: 1,
                      color: str > 14 ? 'rgba(255,255,255,0.9)' : recoveryColor(rec),
                    }}>
                      {Math.round(rec)}
                    </span>
                  )}
                  {hasActivity && (
                    <span style={{ fontSize: 11, lineHeight: 1 }}>
                      {acts.length > 1 ? '⚡' : typeIcon(acts[0]?.type)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      </div></div>{/* end scroll wrapper */}

      {/* Legend */}
      <div style={legendRow}>
        <LegendItem color="var(--good)"  text="Recovery ≥67%" />
        <LegendItem color="var(--warn)"  text="Recovery 34–66%" />
        <LegendItem color="var(--bad)"   text="Recovery <34%" />
        <LegendItem bg="rgba(252,76,2,0.6)" text="High strain" />
        <LegendItem color="var(--accent)" text="Today" bordered />
      </div>
    </div>
  )
}

function typeIcon(type) {
  const m = { Run: '🏃', Ride: '🚴', Swim: '🏊', Walk: '🚶', Hike: '🥾', WeightTraining: '🏋️', Workout: '💪', Yoga: '🧘' }
  return m[type] || '⚡'
}

function LegendItem({ color, bg, text, bordered }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{
        width: 10, height: 10, borderRadius: 2, flexShrink: 0,
        background: bg || 'transparent',
        border: `2px solid ${bordered ? 'var(--accent)' : color || 'transparent'}`,
      }} />
      {text}
    </span>
  )
}

const titleRow = { marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }

const dayLabelRow = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4,
}
const dayLabel = { textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const weekRow  = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }
const legendRow = { display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }
