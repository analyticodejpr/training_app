import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Activity, CalendarDays, Users, User } from 'lucide-react'

const TABS = [
  { path: '/',           Icon: Home,        label: 'Home' },
  { path: '/activities', Icon: Activity,    label: 'Activities' },
  { path: '/training',   Icon: CalendarDays,label: 'Training' },
  { path: '/social',     Icon: Users,       label: 'Social' },
  { path: '/account',    Icon: User,        label: 'Profile' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid #EAECF0',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      display: 'flex',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
    }}>
      {TABS.map(({ path, Icon, label }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1, minHeight: 60,
              padding: '10px 0 8px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? '#6366F1' : '#9CA3AF',
              transition: 'color 0.15s',
            }}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.3 : 1.7}
              color={active ? '#6366F1' : '#9CA3AF'}
            />
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              letterSpacing: '-0.01em', lineHeight: 1,
              color: active ? '#6366F1' : '#9CA3AF',
              fontFamily: 'inherit',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
