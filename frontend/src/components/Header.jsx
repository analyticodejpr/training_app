import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDateRange, PERIODS } from '../context/DateRangeContext'
import { useAuth } from '../context/AuthContext'
import { disconnectStrava, disconnectWhoop, connectStrava, connectWhoop } from '../utils/api'
import { cn } from '@/lib/utils'

// shadcn structural primitives
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from '@/components/ui/navigation-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet'

const NAV_LINKS = [
  { to: '/',         label: 'Today'    },
  { to: '/training', label: 'Training' },
  { to: '/recovery', label: 'Recovery' },
  { to: '/progress', label: 'Progress' },
]

export default function Header({ authStatus, onDisconnect, theme, setTheme }) {
  const [confirming, setConfirming] = useState(null)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const { period, setPeriod }       = useDateRange()
  const { user, signOut }           = useAuth()
  const location                    = useLocation()
  const navigate                    = useNavigate()
  const isLight                     = theme === 'light'
  const anyConnected                = authStatus?.strava || authStatus?.whoop

  // Derive a short display label from the user's email
  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

  async function handleDisconnect(provider) {
    if (confirming !== provider) { setConfirming(provider); return }
    if (provider === 'strava') await disconnectStrava()
    else await disconnectWhoop()
    setConfirming(null)
    onDisconnect?.()
  }

  const currentLabel = NAV_LINKS.find(({ to }) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  )?.label ?? 'Menu'

  return (
    <header style={shell} className="app-shell header-safe">
      {/* Cockpit accent stripe */}
      <div className="shell-stripe" />

      {/* ── 3-column grid: brand | nav | controls ── */}
      <div style={inner} className="header-inner">

        {/* ── Col 1: Brand ── */}
        <div style={brand}>
          <img src="/logo.svg" alt="" width="20" height="20"
            style={{ borderRadius: 5, flexShrink: 0, opacity: 0.9 }} />
          <span style={brandLabel}>
            Training<span style={{ color: 'var(--accent)', fontWeight: 800 }}>Hub</span>
          </span>
        </div>

        {/* ── Col 2: Desktop nav (NavigationMenu) / Mobile page label ── */}
        <div style={centerCol}>
          {anyConnected && (
            // NavigationMenu provides role="navigation" + keyboard traversal via Radix
            // We use NavLink directly inside NavigationMenuItem (not NavigationMenuLink)
            // because NavLink's className prop is a function — asChild+Slot would lose it.
            // NavLink already sets aria-current="page" on the active route automatically.
            <NavigationMenu
              className="desktop-nav h-full"
              delayDuration={0}
            >
              <NavigationMenuList className={cn(
                // Override shadcn defaults: remove space-x-1, align to header height
                'h-full items-center gap-1 space-x-0',
              )}>
                {NAV_LINKS.map(({ to, label }) => {
                  const isActive = to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(to)
                  return (
                    <NavigationMenuItem key={to}>
                      <NavLink
                        to={to}
                        className={cn(
                          // Base capsule geometry
                          'flex items-center px-3 py-[5px] rounded-lg',
                          'text-[13px] tracking-[-0.02em] whitespace-nowrap',
                          'transition-colors duration-[180ms]',
                          // Focus ring uses our accent
                          'focus-visible:outline-none focus-visible:ring-2',
                          'focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-0',
                          // Active: surface fill + strong text (CSS class handles bg via --surface-3)
                          isActive
                            ? 'nav-tab-active font-[650]'
                            : 'font-[480] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]',
                        )}
                      >
                        {label}
                      </NavLink>
                    </NavigationMenuItem>
                  )
                })}
              </NavigationMenuList>
            </NavigationMenu>
          )}

          {/* Mobile: current page name */}
          <div style={mobilePageLabel} className="mobile-nav-row">
            <span style={mobilePageText}>{currentLabel}</span>
          </div>
        </div>

        {/* ── Col 3: Controls ── */}
        <div style={controls}>

          {/* Period picker — Tabs (desktop only)
              Radix Tabs gives us: keyboard arrow-key navigation, aria-selected,
              role="tablist"/"tab", and controlled value synced to DateRangeContext. */}
          {anyConnected && (
            <Tabs
              value={period}
              onValueChange={setPeriod}
              className="desktop-nav"
            >
              <TabsList className={cn(
                // Strip shadcn defaults: remove bg, height constraint, padding, rounding
                'h-auto rounded-none bg-transparent p-0 gap-0',
              )}>
                {PERIODS.map(p => (
                  <TabsTrigger
                    key={p.key}
                    value={p.key}
                    className={cn(
                      // Geometry
                      'h-auto rounded-md px-[9px] py-[4px]',
                      // Typography — HUD label style
                      'text-[10.5px] tracking-[0.05em] uppercase font-[450]',
                      // Remove shadcn ring defaults, add ours
                      'ring-offset-0 focus-visible:ring-2',
                      'focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-0',
                      // Inactive color
                      'text-[var(--text-dim)]',
                      // Active — Radix sets data-[state=active] on the current trigger
                      'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                      'data-[state=active]:text-[var(--accent)] data-[state=active]:font-[660]',
                      // Transition
                      'transition-colors duration-200',
                    )}
                  >
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Platform pills (desktop only) */}
          <div style={pillRow} className="desktop-nav">
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

          <div style={vline} className="desktop-nav" />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            title={isLight ? 'Dark mode' : 'Light mode'}
            style={themeBtn}
            className="theme-btn"
          >
            {isLight ? <MoonIcon /> : <SunIcon />}
          </button>

          {/* User avatar — links to /account (desktop) */}
          <button
            onClick={() => navigate('/account')}
            title={`${user?.email ?? ''} — Account`}
            style={userBtn}
            className="desktop-nav"
          >
            {userInitial}
          </button>

          {/* ── Mobile menu — Sheet (bottom drawer) ──────────────────────────────
              Sheet replaces the old fixed-position dropdown. Benefits:
              - Native bottom-sheet UX on iOS/Android
              - Radix Dialog: focus trap, scroll lock, aria-modal, Escape key close
              - Controlled (open/menuOpen) so we keep the confirm-disconnect flow
              ──────────────────────────────────────────────────────────────────── */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                style={burgerBtn}
                className="mobile-nav-row"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </SheetTrigger>

            <SheetContent
              side="bottom"
              className={cn(
                // Surface — match our panel system
                'bg-[var(--surface)] border-t border-[var(--border)]',
                // Shape — round top corners, no side/bottom rounding
                'rounded-t-[22px]',
                // Sizing
                'max-h-[88vh] p-0',
                // Shadow
                '[box-shadow:var(--shadow)]',
                // Hide the auto-generated X close button — drag handle + Escape serve this
                '[&>button:first-of-type]:hidden',
              )}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-[3px] rounded-full bg-[var(--border-hi)]" />
              </div>

              {/* Nav links */}
              {anyConnected && NAV_LINKS.map(({ to, label }) => {
                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
                return (
                  <SheetClose asChild key={to}>
                    <NavLink
                      to={to}
                      style={dropLink(isActive)}
                    >
                      {label}
                    </NavLink>
                  </SheetClose>
                )
              })}

              {/* Period + auth footer */}
              <div style={dropFooter}>
                {anyConnected && (
                  <div style={dropSegTrack}>
                    {PERIODS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => { setPeriod(p.key); setMenuOpen(false) }}
                        style={dropSegBtn(p.key === period)}
                        className={p.key === period ? 'seg-active' : ''}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                <div style={dropAuthRow}>
                  <PlatformPill
                    label="Strava"
                    connected={authStatus?.strava}
                    confirming={confirming === 'strava'}
                    color="var(--accent)"
                    onConnect={() => { connectStrava(); setMenuOpen(false) }}
                    onDisconnect={() => handleDisconnect('strava')}
                  />
                  <PlatformPill
                    label="WHOOP"
                    connected={authStatus?.whoop}
                    confirming={confirming === 'whoop'}
                    color="var(--whoop)"
                    onConnect={() => { connectWhoop(); setMenuOpen(false) }}
                    onDisconnect={() => handleDisconnect('whoop')}
                  />
                </div>

                {/* Sign out row */}
                <div style={dropSignOutRow}>
                  <span style={dropEmail}>{user?.email}</span>
                  <button onClick={signOut} style={dropSignOutBtn}>Sign out</button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </div>
    </header>
  )
}

// ── Platform pill ──────────────────────────────────────────────────────────────

function PlatformPill({ label, connected, confirming, color, onConnect, onDisconnect }) {
  return (
    <button
      onClick={connected ? onDisconnect : onConnect}
      title={connected && confirming ? 'Click again to disconnect' : undefined}
      className="header-pill"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${connected ? color + '28' : 'var(--border)'}`,
        background: connected ? color + '0d' : 'transparent',
        color: connected ? color : 'var(--text-muted)',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        letterSpacing: '0.01em',
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%',
          background: connected ? color : 'var(--border-hi)',
          flexShrink: 0,
          boxShadow: connected ? `0 0 6px ${color}cc` : 'none',
          transition: 'all 0.22s',
        }}
        className={connected ? 'glow-pulse' : ''}
      />
      {confirming ? 'Confirm?' : connected ? label : `Connect ${label}`}
    </button>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="5" x2="16" y2="5" />
      <line x1="2" y1="9" x2="16" y2="9" />
      <line x1="2" y1="13" x2="16" y2="13" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="3" x2="15" y2="15" />
      <line x1="15" y1="3" x2="3" y2="15" />
    </svg>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const shell = {
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
}

const inner = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '0 28px',
  height: 62,
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  position: 'relative',
}

const brand = {
  display: 'flex', alignItems: 'center', gap: 9,
}

const brandLabel = {
  fontWeight: 700,
  fontSize: 14.5,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
}

const centerCol = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 62,
}

const mobilePageLabel = {
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
}

const mobilePageText = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--text)',
}

const controls = {
  display: 'flex', alignItems: 'center', gap: 8,
  justifyContent: 'flex-end',
}

const pillRow = {
  display: 'flex', alignItems: 'center', gap: 4,
}

const vline = {
  width: 1, height: 16,
  background: 'var(--border)',
  flexShrink: 0, opacity: 0.8,
}

const themeBtn = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'border-color 0.18s',
  color: 'var(--text-muted)',
  flexShrink: 0,
}

const burgerBtn = {
  display: 'none',
  width: 36, height: 36,
  alignItems: 'center', justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  borderRadius: 8,
  flexShrink: 0,
  marginLeft: 2,
}

// ── Sheet (mobile bottom drawer) content styles ────────────────────────────────

const dropLink = (active) => ({
  display: 'block',
  padding: '15px 22px',
  fontSize: 14,
  fontWeight: 600,
  color: active ? 'var(--accent)' : 'var(--text)',
  background: active ? 'var(--accent-dim)' : 'transparent',
  borderBottom: '1px solid var(--border)',
  textDecoration: 'none',
  transition: 'background 0.15s',
  letterSpacing: '-0.02em',
})

const dropFooter = {
  padding: '14px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--surface-2)',
}

const dropSegTrack = {
  display: 'flex',
  gap: 0,
  background: 'var(--surface-3)',
  borderRadius: 10,
  padding: '3px',
  border: '1px solid var(--border)',
}

const dropSegBtn = (active) => ({
  flex: 1,
  padding: '7px 4px',
  borderRadius: 7,
  border: 'none',
  background: 'transparent',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  fontSize: 12,
  fontWeight: active ? 640 : 450,
  cursor: 'pointer',
  transition: 'color 0.15s',
  fontFamily: 'inherit',
  textAlign: 'center',
  letterSpacing: '0.02em',
  lineHeight: 1,
})

const dropAuthRow = {
  display: 'flex', gap: 6,
}

const userBtn = {
  width: 30, height: 30, borderRadius: '50%',
  border: '1px solid var(--border)',
  background: 'var(--accent)1a',
  color: 'var(--accent)',
  fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
  letterSpacing: 0,
  transition: 'background 0.15s',
  fontFamily: 'inherit',
}

const dropSignOutRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 8, paddingTop: 4,
}

const dropEmail = {
  fontSize: 12, color: 'var(--text-muted)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  flex: 1,
}

const dropSignOutBtn = {
  padding: '6px 14px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer', flexShrink: 0,
  fontFamily: 'inherit',
}
