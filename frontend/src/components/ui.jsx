/**
 * ui.jsx — Shared premium design system components.
 * Import from here in all pages to ensure consistent visual language.
 */

// ── Shared chart tooltip/axis style ─────────────────────────────────────────

export const TOOLTIP_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-hi)',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
  color: 'var(--text)',
}

export const AXIS_STYLE = {
  tick: { fill: 'var(--text-muted)', fontSize: 10 },
  axisLine: false,
  tickLine: false,
}

export const GRID_STYLE = {
  strokeDasharray: '1 4',
  stroke: 'var(--chart-grid)',
  vertical: false,
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function PageWrapper({ children }) {
  return (
    <main style={pageStyle} className="fade-up page-wrapper">
      {children}
    </main>
  )
}

export function TwoCol({ children }) {
  return (
    <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
      {children}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

/**
 * Premium card surface.
 * `glow` — optional CSS shadow string to add an ambient glow.
 * `noPad` — skip default padding (use when chart bleeds to edges).
 */
export function Card({ children, glow, noPad, style }) {
  return (
    <div
      className={`card-premium${noPad ? '' : ' card'}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: noPad ? 0 : '22px 24px',
        boxShadow: glow
          ? `var(--shadow-sm), var(--inset-hi), ${glow}`
          : 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────

/**
 * Left-bar accent section title — no emoji, clean typographic hierarchy.
 * `accentColor` — defaults to --accent (orange); pass another color for context.
 */
export function SectionTitle({ title, note, accentColor, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, ...style }}>
      <div style={{
        width: 3, height: 15, borderRadius: 2,
        background: accentColor || 'var(--accent)',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
        {title}
      </span>
      {note && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>
          {note}
        </span>
      )}
    </div>
  )
}

// ── ChartCard ────────────────────────────────────────────────────────────────

/** Card that wraps a chart with a SectionTitle pre-applied. */
export function ChartCard({ title, note, accentColor, glow, children, headerRight }) {
  return (
    <Card glow={glow}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <SectionTitle title={title} note={note} accentColor={accentColor} style={{ marginBottom: 14 }} />
        {headerRight && <div>{headerRight}</div>}
      </div>
      {children}
    </Card>
  )
}

// ── State components ──────────────────────────────────────────────────────────

export function EmptyNote({ children }) {
  return (
    <div style={{
      padding: '40px 0',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

export function Loader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60vh', gap: 14,
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13 }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function PageSplash() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 12, color: 'var(--text-muted)', fontSize: 15,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Pill button ───────────────────────────────────────────────────────────────

export function PillBtn({ active, onClick, children, color }) {
  const activeColor = color || 'var(--accent)'
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? `1px solid ${activeColor}55` : '1px solid var(--border)',
        background: active ? `${activeColor}18` : 'transparent',
        color: active ? activeColor : 'var(--text-muted)',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// ── Small metric tile ─────────────────────────────────────────────────────────

export function MetricTile({ label, value, unit, sub, color, delta, deltaGood }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-mono" style={{
          fontSize: 26, fontWeight: 800,
          color: color || 'var(--text)',
          lineHeight: 1, letterSpacing: '-0.5px',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div style={{ fontSize: 10, marginTop: 4, color: deltaGood ? 'var(--good)' : 'var(--bad)' }}>
          {delta}
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Internal ──────────────────────────────────────────────────────────────────

const pageStyle = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '24px 24px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}
