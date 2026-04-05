import { NavLink, useLocation } from 'react-router-dom'
import { useDateRange, PERIODS } from '../context/DateRangeContext'

const NAV_LINKS = [
  { to: '/',         label: 'Today'    },
  { to: '/training', label: 'Training' },
  { to: '/recovery', label: 'Recovery' },
  { to: '/progress', label: 'Progress' },
]

export default function Nav() {
  const { period, setPeriod } = useDateRange()
  const location = useLocation()

  return (
    <div style={wrapper} className="glass nav-wrapper">
      <div style={inner} className="nav-inner">
        {/* Page tabs — segmented pill style */}
        <nav style={navLinks} className="nav-links">
          {NAV_LINKS.map(({ to, label }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)
            return (
              <NavLink key={to} to={to} style={linkStyle(isActive)} className="nav-link">
                {label}
              </NavLink>
            )
          })}
        </nav>

        {/* Date range — compact segmented bar */}
        <div style={periodBar} className="period-bar">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={periodBtn(p.key === period)}
              className="period-btn"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const wrapper = {
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 54,   /* header height (52px) + accent line (2px) */
  zIndex: 90,
}

const inner = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '0 24px',
  height: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
}

const navLinks = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  height: '100%',
}

const linkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '4px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.01em',
  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
  background: isActive ? 'var(--accent-dim)' : 'transparent',
  textDecoration: 'none',
  transition: 'color 0.15s, background 0.15s',
  border: isActive ? '1px solid rgba(255,85,0,0.22)' : '1px solid transparent',
  whiteSpace: 'nowrap',
})

const periodBar = {
  display: 'flex',
  gap: 1,
  alignItems: 'center',
  background: 'var(--surface-2)',
  borderRadius: 10,
  padding: '3px',
  border: '1px solid var(--border)',
}

const periodBtn = (active) => ({
  padding: '3px 10px',
  borderRadius: 7,
  border: 'none',
  background: active ? 'var(--surface-3)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  boxShadow: active ? 'var(--shadow-xs), var(--inset-hi)' : 'none',
})
