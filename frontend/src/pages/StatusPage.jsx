import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Dev/debug screen — visible only to signed-in users at /status.
 * Shows auth identity, profile existence, and row counts per table.
 * Not linked from main nav; navigate manually or add a temporary link.
 */
export default function StatusPage() {
  const { user, signOut } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('provider_connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('daily_metrics').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([profile, conns, acts, metrics]) => {
      if (profile.error) console.warn('[status] profiles:', profile.error.message)
      setStats({
        profileExists:       !!profile.data,
        providerConnections: conns.count ?? 0,
        activities:          acts.count  ?? 0,
        dailyMetrics:        metrics.count ?? 0,
      })
      setLoading(false)
    })
  }, [user])

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.badge}>DEV</span>
          <h1 style={s.title}>Auth Status</h1>
        </div>

        <table style={s.table}>
          <tbody>
            <Row label="User ID"   value={user?.id} mono />
            <Row label="Email"     value={user?.email} />
            <Row label="Provider"  value={user?.app_metadata?.provider ?? '—'} />
            <Row label="Created"   value={user?.created_at ? new Date(user.created_at).toLocaleString() : '—'} />
          </tbody>
        </table>

        <div style={s.divider} />

        {loading ? (
          <p style={s.dim}>Loading DB counts…</p>
        ) : (
          <table style={s.table}>
            <tbody>
              <Row label="profiles row"          value={stats.profileExists ? '✓ exists' : '✗ missing'} ok={stats.profileExists} />
              <Row label="provider_connections"  value={stats.providerConnections} />
              <Row label="activities"            value={stats.activities} />
              <Row label="daily_metrics"         value={stats.dailyMetrics} />
            </tbody>
          </table>
        )}

        {stats && !stats.profileExists && (
          <p style={s.warn}>
            No row in public.profiles for this user. Check the on_auth_user_created trigger.
          </p>
        )}

        <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
      </div>
    </div>
  )
}

function Row({ label, value, mono, ok }) {
  const valueStyle = {
    ...s.value,
    ...(mono ? { fontFamily: 'monospace', fontSize: 11 } : {}),
    ...(ok === true  ? { color: 'var(--good)' } : {}),
    ...(ok === false ? { color: 'var(--bad)'  } : {}),
  }
  return (
    <tr>
      <td style={s.label}>{label}</td>
      <td style={valueStyle}>{String(value ?? '—')}</td>
    </tr>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '48px 24px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    maxWidth: 520,
    width: '100%',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 20,
  },
  badge: {
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.06em',
    background: 'var(--accent)',
    color: '#fff',
    padding: '2px 7px',
    borderRadius: 5,
  },
  title: {
    fontSize: 18, fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.03em',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  label: {
    padding: '6px 0',
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
    width: '40%',
    verticalAlign: 'top',
  },
  value: {
    padding: '6px 0',
    fontSize: 13,
    color: 'var(--text)',
    wordBreak: 'break-all',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '16px 0',
  },
  dim: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  warn: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--bad)',
    background: 'var(--bad-dim)',
    border: '1px solid var(--bad)',
    borderRadius: 8,
    padding: '8px 12px',
    lineHeight: 1.5,
  },
  signOutBtn: {
    marginTop: 24,
    padding: '9px 18px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
