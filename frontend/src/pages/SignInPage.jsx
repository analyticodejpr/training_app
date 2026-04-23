import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DotPattern } from '../components/ui/dot-pattern'
import { AnimatedGradientText } from '../components/ui/animated-gradient-text'
import { ShimmerButton } from '../components/ui/shimmer-button'

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After Google auth, Supabase redirects here with a PKCE code
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser navigates to Google — no further action needed here
  }

  return (
    <div style={{ ...s.page, position: 'relative', overflow: 'hidden' }}>
      <DotPattern
        glow
        className="opacity-[0.06] text-[var(--text-dim)]"
        width={20}
        height={20}
      />

      <div style={s.card}>
        <img src="/logo.svg" alt="" width="36" height="36"
          style={{ borderRadius: 10, marginBottom: 22, opacity: 0.95 }} />

        <h1 style={s.title}>
          <AnimatedGradientText
            colorFrom="var(--accent)"
            colorTo="#f97316"
            speed={0.7}
          >
            Training
          </AnimatedGradientText>
          <span style={{ color: 'var(--text)' }}>Hub</span>
        </h1>

        <p style={s.sub}>
          Sign in to access your training dashboard.
        </p>

        {error && <p style={s.error}>{error}</p>}

        <ShimmerButton
          onClick={handleGoogleSignIn}
          disabled={loading}
          background="var(--surface-2)"
          shimmerColor="var(--accent)"
          borderRadius="12px"
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
            gap: 10,
            letterSpacing: '-0.01em',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {!loading && <GoogleIcon />}
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </ShimmerButton>

        <p style={s.note}>
          Your data is only visible to you. OAuth tokens are encrypted at rest.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 'clamp(28px, 6vw, 52px) clamp(24px, 6vw, 44px)',
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    marginBottom: 10,
    color: 'var(--text)',
  },
  sub: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 32,
    lineHeight: 1.6,
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '13px 20px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  error: {
    fontSize: 13,
    color: 'var(--bad)',
    background: 'var(--bad-dim)',
    border: '1px solid var(--bad)',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 16,
    width: '100%',
    textAlign: 'left',
  },
  note: {
    marginTop: 24,
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
}
