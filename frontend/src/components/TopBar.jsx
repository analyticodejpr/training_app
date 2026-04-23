/**
 * TopBar — sticky top bar.
 * Left: ZONE logo
 * Right: theme toggle
 * Connection buttons and profile have moved to their respective pages / bottom dock.
 */
import { useEffect, useState } from 'react'

export default function TopBar({ theme, setTheme }) {
  const isLight = theme === 'light'

  // Keep data-theme in sync (AppShell also does this, but belt-and-suspenders)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <header
      className="topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
        flexShrink: 0,
      }}
    >
      {/* Safe-area spacer — fills status-bar height on iPhone */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }} />

      {/* Nav row — always 56 px */}
      <div
        className="topbar-nav"
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '28px',
          paddingRight: '28px',
          gap: 16,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img
            src="/logo.svg" alt=""
            width="20" height="20"
            style={{ borderRadius: 5, flexShrink: 0, opacity: 0.9 }}
          />
          <span style={{
            fontSize: 17, fontWeight: 900,
            letterSpacing: '-0.06em',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            Z<span style={{ color: 'var(--accent)' }}>O</span>NE
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          title={isLight ? 'Dark mode' : 'Light mode'}
          style={{
            width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9, border: '1px solid var(--border)',
            background: 'transparent', cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {isLight ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>
    </header>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
