import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'

const BRAND = '#e04e1f'

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { id: '/',           label: 'Dashboard',  icon: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
      { id: '/activities', label: 'Activities', icon: 'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14a8 8 0 01-6-2.7A5 5 0 0112 14a5 5 0 016 1.3A8 8 0 0112 20z' },
    ],
  },
  {
    section: 'TRAINING',
    items: [
      { id: '/training', label: 'Plan Builder', icon: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z' },
    ],
  },
  {
    section: 'DATA',
    items: [
      { id: '/account', label: 'Strava',  icon: 'M13 3L8 13h4l-1 8 7-10h-4z', provider: 'strava' },
      { id: '/account', label: 'WHOOP',   icon: 'M12 21C6.37 15.46 1 11.19 1 6.79 1 3.13 4.15.5 7.5.5c1.74 0 3.41.81 4.5 2.09C13.09 1.31 14.76.5 16.5.5 19.85.5 23 3.13 23 6.79c0 4.4-5.37 8.67-11 14.21z', provider: 'whoop' },
    ],
  },
  {
    section: 'COMMUNITY',
    items: [
      { id: '/social', label: 'Social', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 2a3 3 0 110-6 3 3 0 010 6zm4 5v-1a3 3 0 00-3-3' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { id: '/account', label: 'Settings', icon: 'M13.5 3H12H8C6.34 3 5 4.34 5 6v12c0 1.66 1.34 3 3 3h3M13.5 3L19 8.625M13.5 3V7.625C13.5 8.18 13.95 8.625 14.5 8.625H19M19 8.625V11.8' },
    ],
  },
]

function NavIcon({ path }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

export default function DesktopSidebar({ authStatus, user }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [hovered, setHovered] = useState(null)

  const stravaConnected = !!authStatus?.strava
  const whoopConnected  = !!authStatus?.whoop

  const isActive = (id) => location.pathname === id

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'ME'
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Athlete'

  return (
    <aside style={S.aside}>
      {/* Logo */}
      <div style={S.logoRow}>
        <img src="/logo.svg" alt="Logo" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
        <span style={S.logoText}>ZONE</span>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={S.section}>
            <div style={S.sectionLabel}>{section}</div>
            {items.map(item => {
              const active  = isActive(item.id) && !item.provider
              const hovId   = `${item.id}-${item.label}`
              const isHov   = hovered === hovId
              const connected = item.provider === 'strava' ? stravaConnected
                : item.provider === 'whoop' ? whoopConnected : null

              return (
                <button
                  key={hovId}
                  onClick={() => navigate(item.id)}
                  onMouseEnter={() => setHovered(hovId)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...S.navItem,
                    ...(active ? S.navItemActive : {}),
                    ...(!active && isHov ? S.navItemHov : {}),
                  }}
                >
                  <span style={{ color: active ? BRAND : '#9CA3AF', transition: 'color 0.15s' }}>
                    <NavIcon path={item.icon} />
                  </span>
                  <span style={{ flex: 1, color: active ? '#1A1B23' : '#6B7280', fontSize: 13, fontWeight: active ? 700 : 500 }}>
                    {item.label}
                  </span>
                  {connected !== null && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: connected ? '#34D399' : '#E5E7EB',
                      boxShadow: connected ? '0 0 5px #34D399' : 'none',
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Profile */}
      <button onClick={() => navigate('/account')} style={{
        ...S.profile,
        ...(isActive('/account') ? S.profileActive : {}),
      }}>
        <div style={S.avatar}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', zIndex: 1, position: 'relative' }}>{initials}</span>
          <div style={S.avatarGlow} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>View Profile</div>
        </div>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </aside>
  )
}

const S = {
  aside: {
    width: 220, minWidth: 220, flexShrink: 0,
    background: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    display: 'flex', flexDirection: 'column',
    height: '100vh', overflow: 'hidden',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 18px 16px',
    borderBottom: '1px solid #EAECF0',
  },
  logoText: { fontWeight: 800, fontSize: 16, color: '#1A1B23', letterSpacing: '-0.04em' },
  nav: { flex: 1, overflowY: 'auto', padding: '8px 10px' },
  section: { marginBottom: 2 },
  sectionLabel: {
    fontSize: 9, fontWeight: 700, color: '#D1D5DB',
    letterSpacing: '0.12em', padding: '12px 8px 5px', textTransform: 'uppercase',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: 'none', background: 'transparent', cursor: 'pointer',
    textAlign: 'left', transition: 'background 0.15s',
  },
  navItemActive: {
    background: `rgba(224,78,31,0.07)`,
    boxShadow: 'inset 0 0 0 1px rgba(224,78,31,0.18)',
  },
  navItemHov: { background: '#F9FAFB' },
  profile: {
    display: 'flex', alignItems: 'center', gap: 10,
    margin: '8px 10px 12px',
    padding: '10px 12px',
    background: '#FFFFFF',
    border: '1px solid #EAECF0',
    borderRadius: 10, cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    width: 'calc(100% - 20px)',
  },
  profileActive: {
    background: 'rgba(224,78,31,0.06)',
    borderColor: 'rgba(224,78,31,0.25)',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
    background: `linear-gradient(135deg,${BRAND},#f47c20)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  avatarGlow: {
    position: 'absolute', inset: -2, borderRadius: 11,
    background: `linear-gradient(135deg,${BRAND},#f47c20)`,
    opacity: 0.25, filter: 'blur(4px)', zIndex: 0,
  },
}
