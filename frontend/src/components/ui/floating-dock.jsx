/**
 * Aceternity-style FloatingDock.
 * Bottom-center fixed dock with spring magnification on hover.
 * Mobile: simpler static dock (no magnification — touch has no hover).
 */
import { useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const BASE    = 44   // resting icon box size (px)
const PEAK    = 68   // max magnified size at cursor center
const REACH   = 140  // distance in px at which magnification fades to 0

export function FloatingDock({ items }) {
  return (
    <>
      {/* Desktop — magnification dock */}
      <DesktopDock items={items} />
      {/* Mobile — static dock */}
      <MobileDock items={items} />
    </>
  )
}

// ── Desktop ───────────────────────────────────────────────────────────────────

function DesktopDock({ items }) {
  const mouseX = useMotionValue(Infinity)

  return (
    <motion.nav
      onMouseMove={e => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{
        alignItems: 'flex-end',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      }}
    >
      {items.map(item => (
        <DockIcon key={item.href} item={item} mouseX={mouseX} />
      ))}
    </motion.nav>
  )
}

function DockIcon({ item, mouseX }) {
  const ref          = useRef(null)
  const [tip, setTip] = useState(false)
  const location     = useLocation()
  const isActive     = item.href === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(item.href)

  // ── Spring magnification ──────────────────────────────────────────────────
  const distance = useTransform(mouseX, val => {
    const b = ref.current?.getBoundingClientRect() ?? { left: 0, width: 0 }
    return val - b.left - b.width / 2
  })

  const rawSize     = useTransform(distance, [-REACH, 0, REACH], [BASE, PEAK, BASE])
  const rawIconSize = useTransform(distance, [-REACH, 0, REACH], [BASE * 0.44, PEAK * 0.44, BASE * 0.44])

  const size     = useSpring(rawSize,     { mass: 0.08, stiffness: 200, damping: 14 })
  const iconSize = useSpring(rawIconSize, { mass: 0.08, stiffness: 200, damping: 14 })

  return (
    <NavLink to={item.href} end={item.href === '/'} style={{ textDecoration: 'none' }}>
      <motion.div
        ref={ref}
        style={{
          width: size,
          height: size,
          background: isActive ? 'var(--accent-dim)' : 'var(--surface-2)',
          border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : 'var(--border)'}`,
        }}
        className="relative flex items-center justify-center rounded-xl cursor-pointer"
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
      >
        {/* Tooltip */}
        <AnimatePresence>
          {tip && (
            <motion.div
              initial={{ opacity: 0, y: 6, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 3, x: '-50%' }}
              transition={{ duration: 0.13 }}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: '50%',
                padding: '4px 10px',
                borderRadius: 8,
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-xs)',
                pointerEvents: 'none',
              }}
            >
              {item.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Icon */}
        <motion.span
          style={{
            width: iconSize,
            height: iconSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {item.icon}
        </motion.span>
      </motion.div>
    </NavLink>
  )
}

// ── Mobile — static icon row ──────────────────────────────────────────────────

function MobileDock({ items }) {
  const location = useLocation()

  return (
    <nav
      className="flex md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: '8px',
        paddingRight: '8px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: '8px',
        background: 'var(--surface)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
      }}
    >
      {items.map(item => {
        const isActive = item.href === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.href)
        return (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 16px',
              borderRadius: 12,
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-dim)', display: 'flex' }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text-dim)',
              letterSpacing: '0.02em',
            }}>
              {item.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
