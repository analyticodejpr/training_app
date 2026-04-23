import { useState, useEffect } from 'react'
import { getWhoopConnection, importWhoop90Days } from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * Compact panel shown on the Dashboard when WHOOP is connected.
 * Displays last-sync time and a manual "Import last 90 days" trigger.
 * Mirrors StravaImportPanel in structure and styling.
 */
export default function WhoopImportPanel() {
  const { user } = useAuth()

  const [conn,        setConn]        = useState(null)
  const [connLoading, setConnLoading] = useState(true)
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    if (!user) return
    getWhoopConnection()
      .then(setConn)
      .catch(() => {})
      .finally(() => setConnLoading(false))
  }, [user])

  async function handleImport() {
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const r = await importWhoop90Days()
      setResult(r)
      getWhoopConnection().then(setConn).catch(() => {})
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
      <div style={s.left}>
        <span style={s.label}>WHOOP</span>
        {lastSync ? (
          <span style={s.meta}>Last imported {lastSync}</span>
        ) : (
          <span style={{ ...s.meta, color: 'var(--bad)' }}>Not yet imported</span>
        )}
      </div>

      <div style={s.right}>
        {result && (
          <span style={s.good}>
            ✓ {result.imported} day{result.imported === 1 ? '' : 's'} imported
          </span>
        )}
        {error && <span style={s.bad}>{error}</span>}
        <button
          onClick={handleImport}
          disabled={importing}
          style={{ ...s.btn, fontFamily: 'inherit' }}
        >
          {importing ? 'Importing…' : 'Import last 90 days'}
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
  left:  { display: 'flex', alignItems: 'center', gap: 10 },
  label: {
    fontSize: 12, fontWeight: 700,
    color: 'var(--whoop)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  meta:  { fontSize: 12, color: 'var(--text-dim)' },
  right: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  good:  { fontSize: 12, color: 'var(--good)', fontWeight: 600 },
  bad:   { fontSize: 12, color: 'var(--bad)' },
  btn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid var(--whoop)44',
    background: 'var(--whoop)12',
    color: 'var(--whoop)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
