import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  const currentLabel = NAV_LINKS.find(({ to }) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  )?.label ?? 'Menu'

  function closeMenu() { setMenuOpen(false) }

  return (
    <>
      <div style={wrapper} className="glass nav-wrapper">
        <div style={inner} className="nav-inner">

          {/* ── Desktop: page tabs ── */}
          <nav style={navLinks} className="nav-links desktop-nav">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
              return (
                <NavLink key={to} to={to} style={linkStyle(isActive)} className="nav-link">
                  {label}
                </NavLink>
              )
            })}
          </nav>

          {/* ── Mobile: current page + burger button ── */}
          <div style={mobileTitleRow} className="mobile-nav-row">
            <span style={mobileCurrentPage}>{currentLabel}</span>
            <button style={burgerBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Open menu">
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/>
                </svg>
              )}
            </button>
          </div>

          {/* ── Period filter (always visible) ── */}
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

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div style={backdrop} onClick={closeMenu} />
          <div style={dropdown} className="mobile-dropdown">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeMenu}
                  style={dropdownLink(isActive)}
                >
                  {label}
                </NavLink>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

const wrapper = {
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 54,
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

const mobileTitleRow = {
  display: 'none', // shown via CSS media query
  alignItems: 'center',
  gap: 8,
  flex: 1,
}

const mobileCurrentPage = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
}

const burgerBtn = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  borderRadius: 8,
  flexShrink: 0,
}

const backdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 88,
}

const dropdown = {
  position: 'fixed',
  top: 96, // below header + nav
  left: 12,
  right: 12,
  zIndex: 89,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const dropdownLink = (isActive) => ({
  padding: '16px 20px',
  fontSize: 15,
  fontWeight: 600,
  color: isActive ? 'var(--accent)' : 'var(--text)',
  background: isActive ? 'var(--accent-dim)' : 'transparent',
  borderBottom: '1px solid var(--border)',
  textDecoration: 'none',
  display: 'block',
  transition: 'background 0.15s',
})
