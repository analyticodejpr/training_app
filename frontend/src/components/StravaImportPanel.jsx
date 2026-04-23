import { useState, useEffect } from 'react'
import { getStravaConnection, importStravaRecent, importStrava90Days } from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * Compact panel shown on the Dashboard when Strava is connected.
 * Displays last-sync time and a manual "Import last 90 days" trigger.
 */
export default function StravaImportPanel() {
  const { user } = useAuth()

  const [conn,        setConn]        = useState(null)
  const [connLoading, setConnLoading] = useState(true)
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState(null)  // { imported: N }
  const [error,       setError]       = useState(null)

  useEffect(() => {
    if (!user) return
    getStravaConnection()
      .then(setConn)
      .catch(() => {})
      .finally(() => setConnLoading(false))
  }, [user])

  async function handleImport(full = false) {
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const r = full ? await importStrava90Days() : await importStravaRecent()
      setResult(r)
      getStravaConnection().then(setConn).catch(() => {})
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (connLoading) return null

  const lastSync = conn?.lastSyncedAt
    ? new Date(conn.lastSyncedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div style={s.bar}>
      {/* Left: status text */}
      <div style={s.left}>
        <span style={s.label}>Strava</span>
        {lastSync ? (
          <span style={s.meta}>Last imported {lastSync}</span>
        ) : (
          <span style={{ ...s.meta, color: 'var(--bad)' }}>Not yet imported</span>
        )}
      </div>

      {/* Right: feedback + button */}
      <div style={s.right}>
        {result && (
          <span style={s.good}>
            ✓ {result.imported} activit{result.imported === 1 ? 'y' : 'ies'} imported
          </span>
        )}
        {error && <span style={s.bad}>{error}</span>}
        <button
          onClick={() => handleImport(false)}
          disabled={importing}
          style={{ ...s.btn, fontFamily: 'inherit' }}
        >
          {importing ? 'Importing…' : 'Sync recent'}
        </button>
        <button
          onClick={() => handleImport(true)}
          disabled={importing}
          style={{ ...s.btn, fontFamily: 'inherit', opacity: 0.6, fontSize: 11 }}
        >
          Full sync
        </button>
      </div>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    flexWrap: 'wrap',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-dim)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  good: {
    fontSize: 12,
    color: 'var(--good)',
    fontWeight: 600,
  },
  bad: {
    fontSize: 12,
    color: 'var(--bad)',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid var(--accent)44',
    background: 'var(--accent)12',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
