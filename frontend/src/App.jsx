import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getAuthStatus } from './utils/api'
import { DateRangeProvider } from './context/DateRangeContext'
import Header from './components/Header'
import Nav    from './components/Nav'
import LoginPage    from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'


const TrainingPage = lazy(() => import('./pages/TrainingPage'))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))

export default function App() {
  const [authStatus, setAuthStatus] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [oauthError, setOauthError] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  async function fetchStatus() {
    try {
      const s = await getAuthStatus()
      setAuthStatus(s)
    } catch {
      setAuthStatus({ strava: false, whoop: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
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
  }, [])

  if (loading) return <Splash />

  const anyConnected = authStatus?.strava || authStatus?.whoop

  return (
    <DateRangeProvider>
      <BrowserRouter>
        <Header
          authStatus={authStatus}
          onDisconnect={fetchStatus}
          theme={theme}
          setTheme={setTheme}
        />

        {oauthError && (
          <div style={{
            background: '#7f1d1d', color: '#fca5a5',
            padding: '10px 24px', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #991b1b',
          }}>
            <span>{oauthError}</span>
            <button onClick={() => setOauthError(null)} style={{
              background: 'none', border: 'none', color: '#fca5a5',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px',
            }}>✕</button>
          </div>
        )}

        {anyConnected && <Nav />}

        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Root: login or daily dashboard */}
            <Route path="/" element={
              anyConnected
                ? <DashboardPage authStatus={authStatus} />
                : <LoginPage authStatus={authStatus} />
            } />

            {/* Legacy /dashboard redirect */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Analytics pages — always render (show connect prompts if not authed) */}
            <Route path="/training"  element={<TrainingPage  authStatus={authStatus} />} />
            <Route path="/recovery"  element={<RecoveryPage  authStatus={authStatus} />} />
            <Route path="/progress"  element={<ProgressPage  authStatus={authStatus} />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DateRangeProvider>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 14 }}>
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
