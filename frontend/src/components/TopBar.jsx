/**
 * TopBar — sticky header.
 * Left:  Z[logo]NE wordmark
 * Right: Strava connect · WHOOP connect · theme toggle
 */
import { useState } from 'react'
import { connectStrava, connectWhoop, disconnectStravaData, disconnectWhoopData } from '../utils/api'

export default function TopBar({ authStatus, onDisconnect, theme, setTheme }) {
  const [confirming, setConfirming] = useState(null)
  const isLight = theme === 'light'

  async function handleDisconnect(provider) {
    if (confirming !== provider) { setConfirming(provider); return }
    try {
      if (provider === 'strava') await disconnectStravaData()
      else await disconnectWhoopData()
    } catch {
      // ignore — connection dot will stay as-is; user can retry
    }
    setConfirming(null)
    onDisconnect?.()
  }

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
      {/* Safe-area spacer — fills iPhone status-bar height */}
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
          gap: 12,
        }}
      >
        {/* Z[logo]NE wordmark */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontSize: 17, fontWeight: 900,
            letterSpacing: '-0.05em',
            color: 'var(--text)',
            display: 'flex', alignItems: 'center',
            lineHeight: 1, gap: 1,
          }}>
            Z
            <img
              src="/logo.svg" alt=""
              width={15} height={15}
              style={{ borderRadius: 3, opacity: 0.92, margin: '0 1px', flexShrink: 0 }}
            />
            NE
          </span>
        </div>

        {/* Right: Strava + WHOOP + theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlatformButton
            label="Strava"
            connected={authStatus?.strava}
            confirming={confirming === 'strava'}
            onConnect={connectStrava}
            onDisconnect={() => handleDisconnect('strava')}
            icon={<StravaLogo size={17} />}
            activeColor="#FC4C02"
          />
          <PlatformButton
            label="WHOOP"
            connected={authStatus?.whoop}
            confirming={confirming === 'whoop'}
            onConnect={connectWhoop}
            onDisconnect={() => handleDisconnect('whoop')}
            icon={<WhoopLogo size={17} />}
            activeColor="#00D4AA"
          />

          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            title={isLight ? 'Dark mode' : 'Light mode'}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer',
              color: 'var(--text-muted)', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {isLight ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
    </header>
  )
}

// ── Platform connection button ────────────────────────────────────────────────

function PlatformButton({ label, connected, confirming, onConnect, onDisconnect, icon, activeColor }) {
  const [tip, setTip] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={connected ? onDisconnect : onConnect}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        style={{
          width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid',
          borderColor: connected ? `color-mix(in srgb, ${activeColor} 30%, transparent)` : 'var(--border)',
          background: connected ? `color-mix(in srgb, ${activeColor} 8%, transparent)` : 'transparent',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.18s',
          flexShrink: 0,
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: connected ? 1 : 0.4,
          filter: connected ? 'none' : 'grayscale(1)',
          transition: 'opacity 0.18s, filter 0.18s',
        }}>
          {icon}
        </span>
        {/* Connection dot */}
        <span style={{
          position: 'absolute',
          bottom: 3, right: 3,
          width: 5, height: 5,
          borderRadius: '50%',
          background: connected ? activeColor : 'var(--border-hi)',
          boxShadow: connected ? `0 0 5px ${activeColor}` : 'none',
          border: '1px solid var(--surface)',
          transition: 'all 0.22s',
        }} className={connected ? 'glow-pulse' : ''} />
      </button>

      {tip && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 7px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 10px',
          borderRadius: 8,
          background: 'var(--surface-3)',
          border: '1px solid var(--border)',
          fontSize: 11.5, fontWeight: 600,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-xs)',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          {confirming ? `Disconnect ${label}?` : connected ? label : `Connect ${label}`}
        </div>
      )}
    </div>
  )
}

// ── Brand SVGs ────────────────────────────────────────────────────────────────

function StravaLogo({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10.5 3L6 12h3.5l1-2h4l1 2H19L14.5 3H10.5zm2 2.5L14 10h-3l1.5-4.5z" fill="#FC4C02" />
      <path d="M15.5 12l-2.5 4.5L10.5 12h2l.5 1 .5-1h2z" fill="#FC4C02" opacity="0.7" />
    </svg>
  )
}

function WhoopLogo({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6l3 12 3-7 3 7 3-12h-2l-1.5 7.5L9 6.5 7.5 13.5 6 6H3z" fill="#00D4AA" />
    </svg>
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
