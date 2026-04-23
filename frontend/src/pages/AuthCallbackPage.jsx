import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Landing page after Supabase Google OAuth redirect.
 * Supabase sends a `code` query param (PKCE flow) — we exchange it for a session,
 * then navigate to the app. The AuthContext picks up the new session automatically
 * via onAuthStateChange.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('[auth/callback] exchange failed:', error.message)
          setError(error.message)
        } else {
          navigate('/', { replace: true })
        }
      })
    } else {
      // No code in URL — could be an error param or a stale redirect
      const err = new URLSearchParams(window.location.search).get('error_description')
        || new URLSearchParams(window.location.search).get('error')
      if (err) {
        setError(decodeURIComponent(err))
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [navigate])

  if (error) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <p style={s.errTitle}>Sign-in failed</p>
          <p style={s.errMsg}>{error}</p>
          <button style={s.retryBtn} onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    gap: 16,
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    maxWidth: 360,
    width: '100%',
    textAlign: 'center',
  },
  errTitle: {
    fontSize: 16, fontWeight: 700,
    color: 'var(--bad)',
    marginBottom: 8,
  },
  errMsg: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  retryBtn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
