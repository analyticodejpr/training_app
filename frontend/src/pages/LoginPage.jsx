import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  connectStrava as doConnectStrava,
  connectWhoop  as doConnectWhoop,
  getStravaConnection,
  importStrava90Days,
} from '../utils/api'

export default function LoginPage({ authStatus }) {
  const { user } = useAuth()
  const stravaConnected = authStatus?.strava
  const whoopConnected  = authStatus?.whoop
  const bothConnected   = stravaConnected && whoopConnected

  // Strava connection details from Supabase
  const [connection,   setConnection]   = useState(null)  // { connected, lastSyncedAt, athleteId }
  const [connLoading,  setConnLoading]  = useState(false)
  // Import state
  const [importState,  setImportState]  = useState('idle') // 'idle'|'loading'|'success'|'error'
  const [importResult, setImportResult] = useState(null)
  const [importError,  setImportError]  = useState(null)

  // Fetch Strava connection details from Supabase when user is signed in + Strava is connected
  useEffect(() => {
    if (!user || !stravaConnected) return
    setConnLoading(true)
    getStravaConnection()
      .then(setConnection)
      .catch(err => console.warn('[LoginPage] connection fetch:', err.message))
      .finally(() => setConnLoading(false))
  }, [user, stravaConnected])

  async function connectStrava() {
    if (!stravaConnected) await doConnectStrava()
  }

  function connectWhoop() {
    if (!whoopConnected) doConnectWhoop()
  }

  async function handleImport() {
    setImportState('loading')
    setImportError(null)
    setImportResult(null)
    try {
      const result = await importStrava90Days()
      setImportResult(result)
      setImportState('success')
      // Refresh connection info to show updated lastSyncedAt
      getStravaConnection().then(setConnection).catch(() => {})
    } catch (err) {
      setImportError(err.response?.data?.error || err.message || 'Import failed')
      setImportState('error')
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
          {/* ── Strava connect button ── */}
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

          {/* ── Strava connection detail + import panel ── */}
          {stravaConnected && (
            <div style={s.importPanel}>
              {/* Connection meta */}
              {!connLoading && connection && (
                <div style={s.connMeta}>
                  {connection.athleteId && (
                    <span style={s.metaItem}>Athlete #{connection.athleteId}</span>
                  )}
                  {connection.lastSyncedAt ? (
                    <span style={s.metaItem}>
                      Last import: {new Date(connection.lastSyncedAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  ) : (
                    <span style={{ ...s.metaItem, color: 'var(--text-muted)' }}>Not imported yet</span>
                  )}
                </div>
              )}

              {/* Import result feedback */}
              {importState === 'success' && importResult && (
                <p style={s.successNote}>
                  ✓ Imported {importResult.imported} activit{importResult.imported === 1 ? 'y' : 'ies'}
                </p>
              )}
              {importState === 'error' && (
                <p style={s.errorNote}>{importError}</p>
              )}

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={importState === 'loading'}
                style={{ ...s.importBtn, fontFamily: 'inherit' }}
              >
                {importState === 'loading' ? 'Importing…' : 'Import last 90 days'}
              </button>
            </div>
          )}

          {/* ── WHOOP connect button ── */}
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
          OAuth tokens are stored securely. No data leaves your machine.
        </p>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
    padding: 'clamp(24px, 6vw, 48px) clamp(20px, 6vw, 40px)',
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
  // Panel that sits below the Strava button when connected
  importPanel: {
    marginTop: -4,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    textAlign: 'left',
  },
  connMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 12px',
  },
  metaItem: {
    fontSize: 11,
    color: 'var(--text-dim)',
    fontWeight: 500,
  },
  importBtn: {
    padding: '9px 16px',
    borderRadius: 8,
    border: '1px solid var(--accent)44',
    background: 'var(--accent)12',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    alignSelf: 'flex-start',
  },
  successNote: {
    fontSize: 12,
    color: 'var(--good)',
    fontWeight: 600,
    margin: 0,
  },
  errorNote: {
    fontSize: 12,
    color: 'var(--bad)',
    margin: 0,
    lineHeight: 1.4,
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
