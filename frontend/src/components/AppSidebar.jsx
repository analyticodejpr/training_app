/**
 * AppSidebar — app-specific sidebar.
 * Collapse/expand driven only by the arrow button in the top-right corner.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Activity, Heart, TrendingUp, Moon, Sun } from 'lucide-react'
import { useDateRange, PERIODS } from '../context/DateRangeContext'
import { disconnectStrava, disconnectWhoop, connectStrava, connectWhoop } from '../utils/api'
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from './ui/aceternity-sidebar'

const NAV_LINKS = [
  { href: '/',         label: 'Today',    icon: <Home       size={17} strokeWidth={1.7} /> },
  { href: '/training', label: 'Training', icon: <Activity   size={17} strokeWidth={1.7} /> },
  { href: '/recovery', label: 'Recovery', icon: <Heart      size={17} strokeWidth={1.7} /> },
  { href: '/progress', label: 'Progress', icon: <TrendingUp size={17} strokeWidth={1.7} /> },
]

export default function AppSidebar({ authStatus, onDisconnect, theme, setTheme }) {
  const [confirming, setConfirming] = useState(null)
  const { period, setPeriod } = useDateRange()
  const isLight = theme === 'light'
  const anyConnected = authStatus?.strava || authStatus?.whoop

  async function handleDisconnect(provider) {
    if (confirming !== provider) { setConfirming(provider); return }
    if (provider === 'strava') await disconnectStrava()
    else await disconnectWhoop()
    setConfirming(null)
    onDisconnect?.()
  }

  return (
    <Sidebar>
      <SidebarBody
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <SidebarInner
          authStatus={authStatus}
          anyConnected={anyConnected}
          isLight={isLight}
          setTheme={setTheme}
          period={period}
          setPeriod={setPeriod}
          confirming={confirming}
          handleDisconnect={handleDisconnect}
        />
      </SidebarBody>
    </Sidebar>
  )
}

// ── Inner content ─────────────────────────────────────────────────────────────

function SidebarInner({
  authStatus, anyConnected,
  isLight, setTheme,
  period, setPeriod,
  confirming, handleDisconnect,
}) {
  const { open, setOpen, setMobileOpen } = useSidebar()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 10px', gap: 0 }}>

      {/* ── Header row: brand + arrow toggle ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 2px',
        marginBottom: 20,
        minHeight: 40,
      }}>
        {/* Brand — hidden when collapsed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <img
            src="/logo.svg" alt=""
            width="20" height="20"
            style={{ borderRadius: 5, flexShrink: 0, opacity: 0.9 }}
          />
          <motion.span
            animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: 15, fontWeight: 700,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
            }}
          >
            Training<span style={{ color: 'var(--accent)', fontWeight: 800 }}>Hub</span>
          </motion.span>
        </div>

        {/* Arrow toggle — always visible, top-right */}
        <button
          onClick={() => setOpen(o => !o)}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            transition: 'border-color 0.15s, color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--border-hi)'
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'var(--surface-2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-dim)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRightIcon />
          </motion.span>
        </button>
      </div>

      {/* ── Navigation ── */}
      {anyConnected && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel open={open}>Menu</SectionLabel>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {NAV_LINKS.map(link => (
              <SidebarLink
                key={link.href}
                link={link}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </nav>
        </section>
      )}

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Period picker ── */}
      {anyConnected && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel open={open}>Period</SectionLabel>

          {/* Expanded: period list */}
          <motion.div
            animate={{ display: open ? 'block' : 'none', opacity: open ? 1 : 0 }}
          >
            {PERIODS.map(p => {
              const active = period === p.key
              return (
                <button
                  key={p.key}
                  onClick={() => { setPeriod(p.key); setMobileOpen(false) }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: active ? 'var(--surface-3)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 14,
                    fontWeight: active ? 650 : 450,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    letterSpacing: '-0.015em',
                  }}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: active ? 'var(--accent)' : 'var(--border-hi)',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }} />
                  {p.label}
                </button>
              )
            })}
          </motion.div>

          {/* Collapsed: tiny period badge */}
          <motion.div
            animate={{ display: open ? 'none' : 'flex', opacity: open ? 0 : 1 }}
            style={{ justifyContent: 'center' }}
          >
            <div
              title="Expand sidebar to change period"
              style={{
                width: 44, padding: '5px 0',
                borderRadius: 7,
                background: 'var(--surface-3)',
                color: 'var(--accent)',
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {PERIODS.find(p => p.key === period)?.label?.slice(0, 4) ?? period}
            </div>
          </motion.div>
        </section>
      )}

      {/* ── Divider ── */}
      <Divider />

      {/* ── Platform status ── */}
      <section style={{ marginBottom: 20, marginTop: 16 }}>
        <SectionLabel open={open}>Platforms</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <PlatformRow
            label="Strava"
            connected={authStatus?.strava}
            confirming={confirming === 'strava'}
            color="var(--accent)"
            onConnect={connectStrava}
            onDisconnect={() => handleDisconnect('strava')}
          />
          <PlatformRow
            label="WHOOP"
            connected={authStatus?.whoop}
            confirming={confirming === 'whoop'}
            color="var(--whoop)"
            onConnect={connectWhoop}
            onDisconnect={() => handleDisconnect('whoop')}
          />
        </div>
      </section>

      {/* ── Divider ── */}
      <Divider />

      {/* ── Theme toggle ── */}
      <section style={{ marginTop: 16 }}>
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 8px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontFamily: 'inherit',
            width: '100%',
            transition: 'background 0.15s',
          }}
          className="hover:bg-[var(--surface-2)]"
        >
          <span style={{
            flexShrink: 0, width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isLight ? <Moon size={17} strokeWidth={1.7} /> : <Sun size={17} strokeWidth={1.7} />}
          </span>
          <motion.span
            animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
            style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}
          >
            {isLight ? 'Dark mode' : 'Light mode'}
          </motion.span>
        </button>
      </section>

    </div>
  )
}

// ── Section label — only shows when expanded ──────────────────────────────────

function SectionLabel({ open, children }) {
  return (
    <motion.div
      animate={{ display: open ? 'block' : 'none', opacity: open ? 1 : 0 }}
      style={{
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
        padding: '0 8px',
        marginBottom: 6,
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 8px' }} />
}

// ── Platform row ──────────────────────────────────────────────────────────────

function PlatformRow({ label, connected, confirming, color, onConnect, onDisconnect }) {
  const { open } = useSidebar()
  return (
    <button
      onClick={connected ? onDisconnect : onConnect}
      title={!open ? (confirming ? 'Click again to confirm' : connected ? `${label} connected` : `Connect ${label}`) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '7px 8px',
        borderRadius: 10,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        width: '100%',
        textAlign: 'left',
        transition: 'background 0.15s',
        color: connected ? color : 'var(--text-dim)',
      }}
      className="hover:bg-[var(--surface-2)]"
    >
      <span style={{
        flexShrink: 0, width: 22, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? color : 'var(--border-hi)',
            boxShadow: connected ? `0 0 6px ${color}cc` : 'none',
            transition: 'all 0.22s',
          }}
          className={connected ? 'glow-pulse' : ''}
        />
      </span>
      <motion.span
        animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
        style={{
          fontSize: 14, fontWeight: 600,
          letterSpacing: '-0.015em',
          whiteSpace: 'nowrap',
          color: connected ? color : 'var(--text-dim)',
        }}
      >
        {confirming ? 'Confirm?' : connected ? label : `Connect ${label}`}
      </motion.span>
    </button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4.5,1.5 9.5,7 4.5,12.5" />
    </svg>
  )
}
