/**
 * ui.jsx — Shared design system components.
 * Import from here in all pages for consistent visual language.
 *
 * Design principles (Nexus-inspired):
 * - White surfaces on light canvas
 * - Soft borders, layered depth via shadows
 * - Typography hierarchy over decorative elements
 * - Premium spacing: breathable but dense
 * - Calm, purposeful color use
 */

// ── Shared chart style constants ─────────────────────────────────────────────

export const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: 'var(--shadow)',
  color: 'var(--text)',
  padding: '10px 14px',
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

// ── Page wrapper ─────────────────────────────────────────────────────────────

export function PageWrapper({ children }) {
  return (
    <main style={pageStyle} className="fade-up page-wrapper">
      {children}
    </main>
  )
}

// ── Page title ────────────────────────────────────────────────────────────────

/** Editorial page heading. Place as first child inside PageWrapper. */
export function PageTitle({ title, note }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <h1 style={{
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-0.04em',
        color: 'var(--text)',
        margin: 0,
        lineHeight: 1.15,
      }}>
        {title}
      </h1>
      {note && (
        <p style={{
          fontSize: 12.5,
          color: 'var(--text-muted)',
          marginTop: 5,
          fontWeight: 450,
          lineHeight: 1.4,
        }}>
          {note}
        </p>
      )}
    </div>
  )
}

// ── Two-column grid ──────────────────────────────────────────────────────────

/**
 * Two-column grid. `ratio` controls column proportions.
 * 'equal' (default) | '2:1' | '1:2' | '3:2' | '2:3'
 */
const RATIO_COLS = {
  'equal': 'repeat(auto-fit, minmax(340px, 1fr))',
  '2:1':   '2fr 1fr',
  '1:2':   '1fr 2fr',
  '3:2':   '3fr 2fr',
  '2:3':   '2fr 3fr',
}

export function TwoCol({ children, ratio = 'equal' }) {
  return (
    <div className="two-col" style={{
      display: 'grid',
      gridTemplateColumns: RATIO_COLS[ratio] ?? RATIO_COLS.equal,
      gap: 18,
    }}>
      {children}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

/**
 * Primary panel surface.
 * Uses CSS shadow tokens — light and dark look distinctly different.
 * `glow`   — optional CSS box-shadow string for ambient accents.
 * `noPad`  — skip default padding (for charts that need to bleed).
 */
export function Card({ children, glow, noPad, style }) {
  return (
    <div
      className={`panel-surface${noPad ? '' : ' card'}`}
      style={{
        padding: noPad ? 0 : '22px 24px',
        boxShadow: glow
          ? `var(--shadow-sm), var(--inset-hi), ${glow}`
          : 'var(--shadow-sm), var(--inset-hi)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────

/**
 * Section header within a card.
 * Minimal accent mark + strong title + optional metadata note.
 * `accentColor` — defaults to var(--accent); pass another color for semantic context.
 */
export function SectionTitle({ title, note, accentColor, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, ...style }}>
      <div style={{
        width: 2, height: 13, borderRadius: 999,
        background: accentColor || 'var(--accent)',
        flexShrink: 0,
        opacity: 0.8,
      }} />
      <span style={{
        fontSize: 13, fontWeight: 650,
        color: 'var(--text)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        {title}
      </span>
      {note && (
        <span style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontWeight: 500,
          marginLeft: 1,
        }}>
          {note}
        </span>
      )}
    </div>
  )
}

// ── ChartCard ────────────────────────────────────────────────────────────────

/** Card pre-fitted with a SectionTitle header and optional right-side control. */
export function ChartCard({ title, note, accentColor, glow, children, headerRight }) {
  return (
    <Card glow={glow}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <SectionTitle title={title} note={note} accentColor={accentColor} />
        {headerRight && (
          <div style={{ flexShrink: 0, marginTop: -2 }}>{headerRight}</div>
        )}
      </div>
      {children}
    </Card>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyNote({ children }) {
  return (
    <div style={{
      padding: '36px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      textAlign: 'center',
    }}>
      {/* Minimal empty indicator */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6"/>
          <line x1="8" y1="5" x2="8" y2="8.5"/>
          <circle cx="8" cy="11" r="0.5" fill="var(--text-dim)" stroke="none"/>
        </svg>
      </div>
      <div style={{
        fontSize: 12.5,
        color: 'var(--text-muted)',
        lineHeight: 1.55,
        maxWidth: 280,
        fontWeight: 450,
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Loading states ────────────────────────────────────────────────────────────

export function Loader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '56vh', gap: 16,
      color: 'var(--text-muted)',
    }}>
      <Spinner size={28} />
      <span style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
        Loading
      </span>
    </div>
  )
}

export function PageSplash() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
    }}>
      <Spinner size={26} />
    </div>
  )
}

function Spinner({ size = 28 }) {
  return (
    <>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `1.5px solid var(--border)`,
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ── Pill button ───────────────────────────────────────────────────────────────

export function PillBtn({ active, onClick, children, color }) {
  const c = color || 'var(--accent)'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: active ? 650 : 500,
        cursor: 'pointer',
        border: active ? `1px solid ${c}40` : '1px solid var(--border)',
        background: active ? `${c}12` : 'var(--surface-2)',
        color: active ? c : 'var(--text-muted)',
        transition: 'all 0.15s',
        letterSpacing: '0.01em',
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
      padding: '13px 15px',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 7,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-mono" style={{
          fontSize: 24, fontWeight: 800,
          color: color || 'var(--text)',
          lineHeight: 1, letterSpacing: '-0.5px',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div style={{ fontSize: 10, marginTop: 4, color: deltaGood ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
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

// ── Divider ───────────────────────────────────────────────────────────────────

/**
 * `variant`:
 *   'default' — 1px rule, margin 18px
 *   'fade'    — gradient rule that fades at edges, margin 20px
 *   'space'   — invisible spacer, 28px gap only
 */
export function Divider({ variant = 'default', style }) {
  if (variant === 'space') {
    return <div style={{ height: 28, ...style }} />
  }
  if (variant === 'fade') {
    return (
      <div style={{
        height: 1,
        background: 'linear-gradient(to right, transparent, var(--border) 20%, var(--border) 80%, transparent)',
        margin: '20px 0',
        ...style,
      }} />
    )
  }
  return (
    <div style={{
      height: 1,
      background: 'var(--border)',
      margin: '18px 0',
      ...style,
    }} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM SURFACE SYSTEM
//  Use these for new work. Legacy Card/SectionTitle/MetricTile remain for compat.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Panel — primary surface ───────────────────────────────────────────────────

const PANEL_PAD = {
  default: '22px 24px',
  tight:   '14px 18px',
  loose:   '28px 32px',
  flush:   0,
}

/**
 * Primary panel surface. Successor to Card.
 * `pad`  — 'default' | 'tight' | 'loose' | 'flush'
 * `glow` — optional CSS box-shadow ambient accent string
 *
 * Renders with the `panel-surface` class which provides:
 *   - gradient top-luminosity overlay (::before pseudo)
 *   - rgba border (atmospheric rather than hard)
 *   - depth-appropriate shadow tokens
 */
export function Panel({ children, pad = 'default', glow, style, className = '' }) {
  return (
    <div
      className={`panel-surface${className ? ' ' + className : ''}`}
      style={{
        padding: PANEL_PAD[pad] ?? PANEL_PAD.default,
        boxShadow: glow
          ? `var(--shadow-sm), var(--inset-hi), ${glow}`
          : 'var(--shadow-sm), var(--inset-hi)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Inset — secondary recessed surface ───────────────────────────────────────

const INSET_PAD = {
  default: '16px 18px',
  tight:   '10px 14px',
  flush:   0,
}

/**
 * Recessed inner section. No shadow — appears sunken inside a Panel.
 * `pad` — 'default' | 'tight' | 'flush'
 */
export function Inset({ children, pad = 'default', style }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: INSET_PAD[pad] ?? INSET_PAD.default,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── PanelHeader — panel title composition ────────────────────────────────────

/**
 * Clean title block. No accent bar — hierarchy from weight and scale only.
 * `label`  — small uppercase eyebrow (e.g. "Recovery · 30d")
 * `title`  — main panel heading
 * `note`   — supporting line below title
 * `right`  — right-aligned slot for controls / toggles
 * `bottom` — margin-bottom override (default 18)
 */
export function PanelHeader({ label, title, note, right, bottom = 18, style }) {
  const hasStack = (label && title) || (title && note)
  return (
    <div style={{
      display: 'flex',
      alignItems: hasStack ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: bottom,
      ...style,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        {label && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            lineHeight: 1,
          }}>
            {label}
          </span>
        )}
        {title && (
          <span style={{
            fontSize: 15,
            fontWeight: 660,
            letterSpacing: '-0.035em',
            color: 'var(--text)',
            lineHeight: 1.2,
          }}>
            {title}
          </span>
        )}
        {note && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontWeight: 450,
            lineHeight: 1.3,
          }}>
            {note}
          </span>
        )}
      </div>
      {right && (
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          {right}
        </div>
      )}
    </div>
  )
}

// ── MetricBlock — premium stat display ───────────────────────────────────────

const MB_SIZES = {
  sm: { value: 18, unit: 10 },
  md: { value: 26, unit: 11 },
  lg: { value: 36, unit: 13 },
}

/**
 * Large stat display. Successor to MetricTile.
 * `size`          — 'sm' | 'md' | 'lg'  (default 'md')
 * `delta`         — trend string, e.g. '+4%' or '↑ 3 pts'
 * `deltaPositive` — bool controlling green vs red color
 */
export function MetricBlock({ label, value, unit, delta, deltaPositive, sub, color, size = 'md' }) {
  const sz = MB_SIZES[size] ?? MB_SIZES.md
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {label && (
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 6,
          lineHeight: 1,
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-mono" style={{
          fontSize: sz.value,
          fontWeight: 800,
          color: color || 'var(--text)',
          lineHeight: 1,
          letterSpacing: '-0.035em',
        }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{
            fontSize: sz.unit,
            color: 'var(--text-muted)',
            fontWeight: 500,
            letterSpacing: 0,
          }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div style={{
          fontSize: 10,
          marginTop: 5,
          fontWeight: 600,
          color: deltaPositive ? 'var(--good)' : 'var(--bad)',
          letterSpacing: '0.01em',
        }}>
          {delta}
        </div>
      )}
      {sub && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: delta ? 2 : 4,
          fontWeight: 450,
          lineHeight: 1.35,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── StatRow + StatCell — horizontal stats strip ───────────────────────────────

/**
 * Horizontal strip of stats. Designed to sit flush at the top or bottom
 * of a Panel (use pad="flush" on Panel, then place StatRow inside).
 * Last StatCell automatically loses its right border via CSS (.stat-row rule).
 */
export function StatRow({ children, style }) {
  return (
    <div className="stat-row" style={{
      display: 'flex',
      alignItems: 'stretch',
      ...style,
    }}>
      {children}
    </div>
  )
}

/**
 * Single cell inside a StatRow.
 * Props mirror MetricBlock but are sized/padded for the strip format.
 */
export function StatCell({ label, value, unit, color, sub, delta, deltaPositive, style }) {
  return (
    <div style={{
      flex: 1,
      padding: '14px 18px',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      minWidth: 0,
      ...style,
    }}>
      {label && (
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 6,
          lineHeight: 1,
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-mono" style={{
          fontSize: 22,
          fontWeight: 800,
          color: color || 'var(--text)',
          lineHeight: 1,
          letterSpacing: '-0.035em',
        }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            fontWeight: 500,
          }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div style={{
          fontSize: 10,
          marginTop: 4,
          fontWeight: 600,
          color: deltaPositive ? 'var(--good)' : 'var(--bad)',
          letterSpacing: '0.01em',
        }}>
          {delta}
        </div>
      )}
      {sub && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: delta ? 2 : 4,
          fontWeight: 450,
          lineHeight: 1.3,
        }}>
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
  /* pb: 120px to clear the floating dock (84px) + breathing room */
  padding: '28px 32px 120px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}
