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
      <div style={wrapper} className="nav-wrapper">
        <div style={inner} className="nav-inner">

          {/* ── Desktop: underline tab navigation ── */}
          <nav style={navLinks} className="nav-links desktop-nav">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  style={linkStyle(isActive)}
                  className={isActive ? 'nav-link nav-tab-active' : 'nav-link'}
                >
                  {label}
                </NavLink>
              )
            })}
          </nav>

          {/* ── Mobile: current page label + burger ── */}
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

          {/* ── Period: premium segmented control ── */}
          <div style={periodBar} className="period-bar">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={periodBtn(p.key === period)}
                className={`period-btn${p.key === period ? ' seg-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {menuOpen && (
        <>
          <div style={backdrop} onClick={closeMenu} />
          <div style={dropdown}>
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
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 52,
  zIndex: 90,
  boxShadow: '0 1px 0 var(--border)',
}

const inner = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '0 24px',
  height: 44,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  gap: 16,
}

const navLinks = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 0,
  height: '100%',
}

// Underline tab style — active tab has a bottom indicator via .nav-tab-active::after
const linkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  height: '100%',
  fontSize: 12.5,
  fontWeight: isActive ? 650 : 500,
  letterSpacing: '-0.01em',
  color: isActive ? 'var(--text)' : 'var(--text-muted)',
  background: 'transparent',
  textDecoration: 'none',
  transition: 'color 0.15s',
  whiteSpace: 'nowrap',
  position: 'relative',
})

// Period segmented control — looks like a pill track with floating thumb
const periodBar = {
  display: 'flex',
  gap: 1,
  alignItems: 'center',
  background: 'var(--surface-2)',
  borderRadius: 9,
  padding: '3px',
  border: '1px solid var(--border)',
  alignSelf: 'center',
}

const periodBtn = (active) => ({
  padding: '3px 11px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  fontSize: 11,
  fontWeight: active ? 650 : 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
})

const mobileTitleRow = {
  display: 'none',
  alignItems: 'center',
  gap: 8,
  flex: 1,
}

const mobileCurrentPage = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--text)',
}

const burgerBtn = {
  width: 44, height: 44,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  top: 96,
  left: 12,
  right: 12,
  zIndex: 89,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: 'var(--shadow)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const dropdownLink = (isActive) => ({
  padding: '15px 20px',
  fontSize: 14,
  fontWeight: 600,
  color: isActive ? 'var(--accent)' : 'var(--text)',
  background: isActive ? 'var(--accent-dim)' : 'transparent',
  borderBottom: '1px solid var(--border)',
  textDecoration: 'none',
  display: 'block',
  transition: 'background 0.15s',
  letterSpacing: '-0.01em',
})
