import { useState } from 'react'
import { disconnectStrava, disconnectWhoop, connectStrava, connectWhoop } from '../utils/api'

export default function Header({ authStatus, onDisconnect, theme, setTheme }) {
  const [confirming, setConfirming] = useState(null)

  async function handleDisconnect(provider) {
    if (confirming !== provider) { setConfirming(provider); return }
    if (provider === 'strava') await disconnectStrava()
    else await disconnectWhoop()
    setConfirming(null)
    onDisconnect?.()
  }


  const isLight = theme === 'light'

  return (
    <header style={header} className="header-safe">
      {/* Premium 2px accent gradient line at top */}
      <div style={accentLine} />

      <div style={inner} className="header-inner">
        {/* Brand */}
        <div style={logo}>
          <img src="/logo.svg" alt="TrainingHub" width="28" height="28" style={{ borderRadius: 8, flexShrink: 0 }} />
          <span style={logoText}>
            Training<span style={{ color: 'var(--accent)' }}>Hub</span>
          </span>
        </div>

        {/* Right controls */}
        <div style={right}>
          <div style={pills}>
            <PlatformPill
              label="Strava"
              connected={authStatus?.strava}
              confirming={confirming === 'strava'}
              color="var(--accent)"
              onConnect={connectStrava}
              onDisconnect={() => handleDisconnect('strava')}
            />
            <PlatformPill
              label="WHOOP"
              connected={authStatus?.whoop}
              confirming={confirming === 'whoop'}
              color="var(--whoop)"
              onConnect={connectWhoop}
              onDisconnect={() => handleDisconnect('whoop')}
            />
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            title={isLight ? 'Dark mode' : 'Light mode'}
            style={themeBtn}
            className="theme-btn"
          >
            {isLight ? (
              /* Moon icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
              </svg>
            ) : (
              /* Sun icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

function PlatformPill({ label, connected, confirming, color, onConnect, onDisconnect }) {
  return (
    <button
      onClick={connected ? onDisconnect : onConnect}
      title={connected && confirming ? 'Click again to disconnect' : undefined}
      className="header-pill"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 13px', borderRadius: 999,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${connected ? color + '40' : 'var(--border)'}`,
        background: connected ? color + '14' : 'transparent',
        color: connected ? color : 'var(--text-muted)',
        transition: 'all 0.18s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: connected ? color : 'var(--border)',
        flexShrink: 0,
        boxShadow: connected ? `0 0 8px ${color}aa` : 'none',
        transition: 'box-shadow 0.2s',
      }} className={connected ? 'glow-pulse' : ''} />
      {confirming ? 'Confirm?' : connected ? label : `Connect ${label}`}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const header = {
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  boxShadow: 'var(--shadow-sm)',
}

const accentLine = {
  height: 2,
  background: 'linear-gradient(to right, var(--accent) 0%, rgba(255,85,0,0.4) 40%, transparent 100%)',
}

const inner = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '0 24px',
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: 0,
}

const logo = {
  display: 'flex', alignItems: 'center', gap: 10,
}

const logoText = {
  fontWeight: 700, fontSize: 16,
  letterSpacing: '-0.4px',
  color: 'var(--text)',
}

const right = { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }

const pills = { display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }

const themeBtn = {
  width: 34, height: 34, borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
  color: 'var(--text-muted)',
  flexShrink: 0,
}
