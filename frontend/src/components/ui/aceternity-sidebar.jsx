/**
 * Aceternity-style collapsible sidebar primitives.
 * Desktop: click-only toggle (no hover). Arrow lives in top-right of sidebar.
 * Mobile: top bar + slide-in overlay drawer.
 */
import { createContext, useContext, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Context ───────────────────────────────────────────────────────────────────

const SidebarContext = createContext(null)

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }) {
  const [open, setOpen]             = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{ open, setOpen, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

// ── Sidebar root ──────────────────────────────────────────────────────────────

export function Sidebar({ children }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

// ── SidebarBody ───────────────────────────────────────────────────────────────

export function SidebarBody({ className, style, children }) {
  return (
    <>
      <DesktopSidebar className={className} style={style}>{children}</DesktopSidebar>
      <MobileSidebar>{children}</MobileSidebar>
    </>
  )
}

// Desktop: sticky left column, width driven purely by open state (click toggle)
function DesktopSidebar({ className, style, children }) {
  const { open } = useSidebar()
  return (
    <motion.div
      className={cn(
        'hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 overflow-hidden',
        className,
      )}
      style={style}
      animate={{ width: open ? 240 : 72 }}
      initial={false}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Mobile: sticky top bar + slide-in overlay drawer
function MobileSidebar({ children }) {
  const { mobileOpen, setMobileOpen } = useSidebar()
  return (
    <>
      <div
        className="flex md:hidden items-center justify-between sticky top-0 z-50 h-14 px-4 app-shell"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          aria-label="Open navigation"
        >
          <BurgerIcon />
        </button>
        <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)' }}>
          Training<span style={{ color: 'var(--accent)', fontWeight: 800 }}>Hub</span>
        </span>
        <div style={{ width: 36 }} />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[99] md:hidden"
              style={{ background: 'rgba(0,0,0,0.52)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-[100] w-72 flex flex-col md:hidden overflow-y-auto"
              style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center justify-between h-14 px-4"
                style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)' }}>
                  Training<span style={{ color: 'var(--accent)', fontWeight: 800 }}>Hub</span>
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  aria-label="Close navigation"
                >
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, padding: 12 }}>{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── SidebarLink ───────────────────────────────────────────────────────────────

export function SidebarLink({ link, className, onClick }) {
  const { open } = useSidebar()
  return (
    <NavLink
      to={link.href}
      end={link.href === '/'}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 py-2.5 px-2 rounded-[10px] transition-all duration-200',
        isActive
          ? 'bg-[var(--surface-3)] text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
        className,
      )}
    >
      {({ isActive }) => (
        <>
          <span
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 22, height: 22, color: isActive ? 'var(--accent)' : 'currentColor' }}
          >
            {link.icon}
          </span>
          <motion.span
            animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
            style={{ fontSize: 15, fontWeight: 550, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}
          >
            {link.label}
          </motion.span>
        </>
      )}
    </NavLink>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function BurgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="2" y1="5" x2="16" y2="5" />
      <line x1="2" y1="9" x2="16" y2="9" />
      <line x1="2" y1="13" x2="16" y2="13" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  )
}
