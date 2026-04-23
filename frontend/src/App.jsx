import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Home, Activity, CalendarDays, User } from 'lucide-react'
import { getAuthStatus, saveToken, getStravaAthlete } from './utils/api'
import { DateRangeProvider } from './context/DateRangeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import TopBar             from './components/TopBar'
import NameSetupModal     from './components/NameSetupModal'
import DateRangePicker    from './components/DateRangePicker'
import { FloatingDock }   from './components/ui/floating-dock'
import SignInPage         from './pages/SignInPage'
import LoginPage          from './pages/LoginPage'
import AuthCallbackPage   from './pages/AuthCallbackPage'
import DashboardPage      from './pages/DashboardPage'

function ProfileIcon({ src }) {
  if (src) {
    return <img src={src} alt="Profile" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover' }} />
  }
  return <User size={22} strokeWidth={1.7} />
}

const TrainingPage = lazy(() => import('./pages/TrainingPage'))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const AccountPage  = lazy(() => import('./pages/AccountPage'))
const StatusPage   = lazy(() => import('./pages/StatusPage'))
const PlannerPage  = lazy(() => import('./pages/PlannerPage'))

function buildDockItems(profilePicture) {
  return [
    { href: '/',         label: 'Today',    icon: <Home         size={22} strokeWidth={1.7} /> },
    { href: '/training', label: 'Training', icon: <Activity     size={22} strokeWidth={1.7} /> },
    { href: '/planner',  label: 'Planner',  icon: <CalendarDays size={22} strokeWidth={1.7} /> },
    { href: '/account',  label: 'Profile',  icon: <ProfileIcon src={profilePicture} /> },
  ]
}

// ── Root: providers only ──────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <DateRangeProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </DateRangeProvider>
    </AuthProvider>
  )
}

// ── AppShell: uses auth context, owns Strava/WHOOP API state ─────────────────
function AppShell() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()

  const [authStatus,      setAuthStatus]      = useState(null)
  const [apiLoading,      setApiLoading]      = useState(true)
  const [oauthError,      setOauthError]      = useState(null)
  const [theme,           setTheme]           = useState(() => localStorage.getItem('theme') || 'light')
  const [showNameSetup,   setShowNameSetup]   = useState(false)
  const [profilePicture,  setProfilePicture]  = useState(null)
  const nameChecked = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  async function fetchStatus() {
    try {
      const s = await getAuthStatus()
      setAuthStatus(s)
      // Fetch Strava profile picture for dock avatar
      if (s?.strava) {
        getStravaAthlete().then(athlete => {
          if (athlete?.profile_medium) setProfilePicture(athlete.profile_medium)
        }).catch(() => {})
      }
    } catch {
      setAuthStatus({ strava: false, whoop: false })
    } finally {
      setApiLoading(false)
    }
  }

  useEffect(() => {
    // Only call the Express API once Supabase confirms a signed-in user
    if (!user) {
      setApiLoading(false)
      return
    }

    const hash = window.location.hash
    if (hash.includes('tok=')) {
      const token = new URLSearchParams(hash.slice(1)).get('tok')
      if (token) saveToken(token)
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    }

    fetchStatus()

    // Check once per session whether full_name is set in profiles
    if (!nameChecked.current) {
      nameChecked.current = true
      import('./lib/supabase').then(({ supabase }) => {
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data?.full_name) setShowNameSetup(true)
          })
      })
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      const whoopErr  = params.get('whoop_error') || ''
      const whoopDesc = params.get('whoop_desc')  || ''
      setOauthError(
        whoopErr
          ? `WHOOP OAuth error: ${whoopErr}${whoopDesc ? ' — ' + whoopDesc : ''}`
          : `OAuth error: ${params.get('error')}`
      )
    }
    if (params.has('connected') || params.has('error')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  // Date range bar is only relevant for data-browsing pages
  const showDateRange = ['/', '/training'].includes(location.pathname)

  // Show splash while either Supabase session OR Express API is resolving
  if (authLoading || (user && apiLoading)) return <Splash />

  // ── Public auth routes (always reachable) ─────────────────────────────────
  if (!user) {
    return (
      <Routes>
        <Route path="/login"         element={<SignInPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*"              element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // ── Authenticated app shell ───────────────────────────────────────────────
  const anyConnected = authStatus?.strava || authStatus?.whoop

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Sticky top bar ── */}
      <TopBar theme={theme} setTheme={setTheme} authStatus={authStatus} onDisconnect={fetchStatus} />

      {/* ── Date range picker bar — only on Today and Training pages ── */}
      {showDateRange && (
        <div className="date-range-bar" style={{
          padding: '12px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--text-dim)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            Date range
          </span>
          <DateRangePicker />
        </div>
      )}

      {/* ── OAuth error banner ── */}
      {oauthError && (
        <div style={{
          background: 'var(--bad-dim)', color: 'var(--bad)',
          padding: '10px 28px', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span>{oauthError}</span>
          <button
            onClick={() => setOauthError(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--bad)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px',
            }}
          >✕</button>
        </div>
      )}

      {/* ── Page content ── */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"         element={<Navigate to="/" replace />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/status"        element={<StatusPage />} />
            <Route path="/" element={
              anyConnected
                ? <DashboardPage authStatus={authStatus} />
                : <LoginPage authStatus={authStatus} />
            } />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/training"  element={<TrainingPage  authStatus={authStatus} />} />
            <Route path="/recovery"  element={<RecoveryPage  authStatus={authStatus} />} />
            <Route path="/progress"  element={<ProgressPage  authStatus={authStatus} />} />
            <Route path="/planner"   element={<PlannerPage   authStatus={authStatus} />} />
            <Route path="/account"   element={<AccountPage   onProviderChange={fetchStatus} />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* ── Floating dock ── */}
      <FloatingDock items={buildDockItems(profilePicture)} />

      {/* ── Name setup modal (shown once if full_name is missing) ── */}
      {showNameSetup && (
        <NameSetupModal
          user={user}
          onDone={() => setShowNameSetup(false)}
        />
      )}
    </div>
  )
}

const spinStyle = {
  width: 28, height: 28, borderRadius: '50%',
  border: '2px solid var(--border)',
  borderTopColor: 'var(--accent)',
  animation: 'spin 0.8s linear infinite',
}

function Splash() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 24,
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <img src="/logo.svg" alt="" width={52} height={52} style={{ borderRadius: 14, opacity: 0.92 }} />
        <span style={{
          fontSize: 34, fontWeight: 900,
          letterSpacing: '-0.06em',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          Z<span style={{ color: 'var(--accent)' }}>O</span>NE
        </span>
      </div>
      <div style={spinStyle} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={spinStyle} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
