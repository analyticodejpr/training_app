const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '48px 40px',
    maxWidth: 440,
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 8,
    letterSpacing: '-0.5px',
  },
  sub: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 36,
    lineHeight: 1.6,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  btn: (color, connected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 24px',
    borderRadius: 12,
    border: `1px solid ${color}55`,
    background: connected ? `${color}22` : `${color}11`,
    color: connected ? color : 'var(--text)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
  }),
  connectedBadge: {
    fontSize: 11,
    background: 'rgba(34,211,160,0.2)',
    color: 'var(--good)',
    padding: '2px 8px',
    borderRadius: 999,
    marginLeft: 'auto',
  },
  divider: {
    margin: '24px 0 16px',
    fontSize: 12,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  goBtn: {
    display: 'block',
    padding: '14px 24px',
    borderRadius: 12,
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'center',
    textDecoration: 'none',
  },
  note: {
    marginTop: 20,
    fontSize: 11,
    color: 'var(--text-muted)',
  },
}

import { getStravaAuthUrl, getWhoopAuthUrl } from '../utils/api'

export default function LoginPage({ authStatus }) {
  const stravaConnected = authStatus?.strava
  const whoopConnected  = authStatus?.whoop
  const bothConnected   = stravaConnected && whoopConnected

  async function connectStrava() {
    if (stravaConnected) return
    try {
      const { url } = await getStravaAuthUrl()
      if (!url) throw new Error('No URL returned')
      window.location.href = url
    } catch (err) {
      alert(`Strava connect failed: ${err.message}`)
    }
  }

  async function connectWhoop() {
    if (whoopConnected) return
    try {
      const { url } = await getWhoopAuthUrl()
      if (!url) throw new Error('No URL returned')
      window.location.href = url
    } catch (err) {
      alert(`WHOOP connect failed: ${err.message}`)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>⚡</div>
        <h1 style={s.title}>Training<span style={{ color: 'var(--accent)' }}>Hub</span></h1>
        <p style={s.sub}>
          Connect your Strava and WHOOP accounts to get a unified view of
          your training load and recovery.
        </p>

        <div style={s.buttons}>
          <button
            onClick={connectStrava}
            style={{ ...s.btn('var(--accent)', stravaConnected), width: '100%', fontFamily: 'inherit' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z"/>
              <path d="M11.768 0l-3.461 6.867H5.244L11.768 13.39 18.29 6.867h-3.063z" opacity=".4"/>
            </svg>
            {stravaConnected ? 'Strava Connected' : 'Connect Strava'}
            {stravaConnected && <span style={s.connectedBadge}>✓</span>}
          </button>

          <button
            onClick={connectWhoop}
            style={{ ...s.btn('var(--whoop)', whoopConnected), width: '100%', fontFamily: 'inherit' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            {whoopConnected ? 'WHOOP Connected' : 'Connect WHOOP'}
            {whoopConnected && <span style={s.connectedBadge}>✓</span>}
          </button>
        </div>

        {bothConnected && (
          <>
            <div style={s.divider}>
              <div style={s.line} /> ready to go <div style={s.line} />
            </div>
            <button onClick={() => window.location.href = '/'} style={{ ...s.goBtn, fontFamily: 'inherit' }}>
              Open Dashboard →
            </button>
          </>
        )}

        {!bothConnected && (stravaConnected || whoopConnected) && (
          <p style={s.note}>Connect both platforms to unlock the full dashboard.</p>
        )}

        <p style={{ ...s.note, marginTop: 28 }}>
          OAuth tokens are stored locally. No data leaves your machine.
        </p>
      </div>
    </div>
  )
}
