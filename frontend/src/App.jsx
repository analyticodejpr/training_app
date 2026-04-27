import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getAuthStatus, saveToken } from './utils/api'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DateRangeProvider } from './context/DateRangeContext'
import MobileHeader   from './components/MobileHeader'
import BottomNav      from './components/BottomNav'
import NameSetupModal from './components/NameSetupModal'
import SignInPage     from './pages/SignInPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import DashboardPage  from './pages/DashboardPage'

const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'))
const TrainingPage   = lazy(() => import('./pages/TrainingPage'))
const SocialPage     = lazy(() => import('./pages/SocialPage'))
const AccountPage    = lazy(() => import('./pages/AccountPage'))
const StatusPage     = lazy(() => import('./pages/StatusPage'))
// Legacy routes redirect
const LoginPage      = lazy(() => import('./pages/LoginPage'))

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

function AppShell() {
  const { user, loading: authLoading } = useAuth()

  const [authStatus,    setAuthStatus]    = useState(null)
  const [apiLoading,    setApiLoading]    = useState(true)
  const [oauthError,    setOauthError]    = useState(null)
  const [showNameSetup, setShowNameSetup] = useState(false)
  const nameChecked = useRef(false)

  async function fetchStatus() {
    try {
      const s = await getAuthStatus()
      setAuthStatus(s)
    } catch {
      setAuthStatus({ strava: false, whoop: false })
    } finally {
      setApiLoading(false)
    }
  }

  useEffect(() => {
    if (!user) { setApiLoading(false); return }

    const hash = window.location.hash
    if (hash.includes('tok=')) {
      const token = new URLSearchParams(hash.slice(1)).get('tok')
      if (token) saveToken(token)
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    }

    fetchStatus()

    if (!nameChecked.current) {
      nameChecked.current = true
      import('./lib/supabase').then(({ supabase }) => {
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => { if (!data?.full_name) setShowNameSetup(true) })
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

  if (authLoading || (user && apiLoading)) return <Splash />

  if (!user) {
    return (
      <Routes>
        <Route path="/login"         element={<SignInPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*"              element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <AuthedApp
      authStatus={authStatus}
      oauthError={oauthError}
      onClearError={() => setOauthError(null)}
      onProviderChange={fetchStatus}
      showNameSetup={showNameSetup}
      onNameDone={() => setShowNameSetup(false)}
      user={user}
    />
  )
}

function AuthedApp({ authStatus, oauthError, onClearError, onProviderChange, showNameSetup, onNameDone, user }) {
  const location = useLocation()

  // Pages that show the header and bottom nav
  const shellPaths = ['/', '/activities', '/training', '/social', '/account']
  const showShell = shellPaths.includes(location.pathname)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F5F6FA' }}>

      {/* Sticky top header */}
      {showShell && <MobileHeader onSync={onProviderChange} />}

      {/* OAuth error banner */}
      {oauthError && (
        <div style={{
          background: '#FEF2F2', color: '#DC2626',
          padding: '10px 20px', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #FECACA', flexShrink: 0,
        }}>
          <span>{oauthError}</span>
          <button
            onClick={onClearError}
            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
          >✕</button>
        </div>
      )}

      {/* Page content */}
      <main style={{
        flex: 1, minWidth: 0,
        paddingBottom: showShell ? 'calc(env(safe-area-inset-bottom, 0px) + 72px)' : 0,
      }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"         element={<Navigate to="/" replace />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/status"        element={<StatusPage />} />
            <Route path="/" element={<DashboardPage authStatus={authStatus} />} />
            <Route path="/activities"    element={<ActivitiesPage authStatus={authStatus} />} />
            <Route path="/training"      element={<TrainingPage authStatus={authStatus} />} />
            <Route path="/social"        element={<SocialPage />} />
            <Route path="/account"       element={<AccountPage onProviderChange={onProviderChange} authStatus={authStatus} />} />
            {/* Legacy redirects */}
            <Route path="/planner"       element={<Navigate to="/training" replace />} />
            <Route path="/recovery"      element={<Navigate to="/" replace />} />
            <Route path="/progress"      element={<Navigate to="/" replace />} />
            <Route path="/dashboard"     element={<Navigate to="/" replace />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Bottom navigation */}
      {showShell && <BottomNav />}

      {showNameSetup && <NameSetupModal user={user} onDone={onNameDone} />}
    </div>
  )
}

const spinStyle = {
  width: 28, height: 28, borderRadius: '50%',
  border: '2px solid #EAECF0',
  borderTopColor: '#6366F1',
  animation: 'spin 0.8s linear infinite',
}

function Splash() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 24,
      background: '#F5F6FA',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, background: '#6366F1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>Z</span>
        </div>
        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.06em', color: '#1A1B23', lineHeight: 1 }}>
          ZO<span style={{ color: '#6366F1' }}>N</span>E
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
