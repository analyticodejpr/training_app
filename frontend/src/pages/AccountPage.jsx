/**
 * AccountPage — Profile tab (route: /account)
 *
 * Mobile design with 3 tabs:
 * - Performance: metrics, HR zones, run zones, power zones
 * - Providers: Strava + WHOOP connection management
 * - Account: profile edit, sign out, delete all data
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getStravaConnection,
  getWhoopConnection,
  disconnectStravaData,
  disconnectWhoopData,
  importStravaRecent,
  importWhoopRecent,
  deleteAllUserData,
  connectStrava,
  connectWhoop,
} from '../utils/api'

// ── Auto-detect metrics from Supabase ─────────────────────────────────────────

async function fetchAutoDetectedMetrics(userId) {
  const [maxHrRes, featuresRes, runRes] = await Promise.all([
    supabase.from('activities').select('max_hr').eq('user_id', userId)
      .not('max_hr', 'is', null).order('max_hr', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('derived_training_features')
      .select('avg_resting_hr_28d, has_whoop, has_strava').eq('user_id', userId)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activities').select('avg_speed_mps')
      .eq('user_id', userId).in('sport_type', ['Run', 'TrailRun', 'VirtualRun'])
      .not('avg_speed_mps', 'is', null).gte('moving_time_s', 1200).lte('moving_time_s', 4500),
  ])
  const maxHrRow = maxHrRes.data
  const features = featuresRes.data
  const runs     = (runRes.data || []).filter(r => Number(r.avg_speed_mps) > 1.5)

  let thresholdPaceSecKm = null
  if (runs.length >= 3) {
    const speeds = runs.map(r => Number(r.avg_speed_mps)).sort((a, b) => a - b)
    const idx    = Math.min(Math.floor(speeds.length * 0.80), speeds.length - 1)
    thresholdPaceSecKm = Math.round(1000 / speeds[idx])
  }
  return {
    suggested: {
      max_hr:                maxHrRow?.max_hr != null ? Math.round(Number(maxHrRow.max_hr)) : null,
      resting_hr:            features?.avg_resting_hr_28d != null ? Math.round(Number(features.avg_resting_hr_28d)) : null,
      threshold_pace_sec_km: thresholdPaceSecKm,
    },
    sources: {
      max_hr:                maxHrRow?.max_hr != null ? 'all-time max from activities' : null,
      resting_hr:            features?.avg_resting_hr_28d != null ? 'WHOOP 28-day average' : null,
      threshold_pace_sec_km: thresholdPaceSecKm != null ? `80th-percentile pace (${runs.length} runs)` : null,
    },
    has_whoop: features?.has_whoop ?? false, has_strava: features?.has_strava ?? false,
  }
}

// ── Zone computations (unchanged) ────────────────────────────────────────────

function computeHRZones(maxHr, lthr) {
  if (lthr) {
    return [
      { name: 'Z1 — Recovery',   lo: 0,                         hi: Math.round(lthr * 0.85) },
      { name: 'Z2 — Aerobic',    lo: Math.round(lthr * 0.85),   hi: Math.round(lthr * 0.89) },
      { name: 'Z3 — Tempo',      lo: Math.round(lthr * 0.90),   hi: Math.round(lthr * 0.94) },
      { name: 'Z4 — Threshold',  lo: Math.round(lthr * 0.95),   hi: Math.round(lthr * 0.99) },
      { name: 'Z5 — VO2max+',    lo: Math.round(lthr * 1.00),   hi: maxHr || Math.round(lthr * 1.06) },
    ]
  }
  if (maxHr) {
    return [
      { name: 'Z1 — Recovery',   lo: 0,                         hi: Math.round(maxHr * 0.60) },
      { name: 'Z2 — Aerobic',    lo: Math.round(maxHr * 0.60),  hi: Math.round(maxHr * 0.70) },
      { name: 'Z3 — Tempo',      lo: Math.round(maxHr * 0.70),  hi: Math.round(maxHr * 0.80) },
      { name: 'Z4 — Threshold',  lo: Math.round(maxHr * 0.80),  hi: Math.round(maxHr * 0.90) },
      { name: 'Z5 — VO2max+',    lo: Math.round(maxHr * 0.90),  hi: maxHr },
    ]
  }
  return null
}

function computeRunZones(t) {
  if (!t) return null
  return [
    { name: 'Z1 — Recovery',  lo: t + 90, hi: null },
    { name: 'Z2 — Aerobic',   lo: t + 45, hi: t + 90 },
    { name: 'Z3 — Tempo',     lo: t + 15, hi: t + 45 },
    { name: 'Z4 — Threshold', lo: t - 5,  hi: t + 15 },
    { name: 'Z5 — VO2max',    lo: null,   hi: t - 5 },
  ]
}

function computePowerZones(ftp) {
  if (!ftp) return null
  return [
    { name: 'Z1 — Recovery', lo: 0,                      hi: Math.round(ftp * 0.55) },
    { name: 'Z2 — Endurance',lo: Math.round(ftp * 0.55), hi: Math.round(ftp * 0.75) },
    { name: 'Z3 — Tempo',    lo: Math.round(ftp * 0.75), hi: Math.round(ftp * 0.90) },
    { name: 'Z4 — Threshold',lo: Math.round(ftp * 0.90), hi: Math.round(ftp * 1.05) },
    { name: 'Z5 — VO2max',   lo: Math.round(ftp * 1.05), hi: Math.round(ftp * 1.20) },
    { name: 'Z6 — Anaerobic',lo: Math.round(ftp * 1.20), hi: null },
  ]
}

const ZONE_COLORS = ['#94A3B8', '#3B9EFF', '#F59E0B', '#F97316', '#EF4444', '#9333EA']

function fmtPace(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = String(Math.round(sec % 60)).padStart(2, '0')
  return `${m}:${s}/km`
}
function fmtSwimPace(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = String(Math.round(sec % 60)).padStart(2, '0')
  return `${m}:${s}/100m`
}
function secsToMinSec(sec) {
  if (sec == null) return ''
  const m = Math.floor(sec / 60), s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}
function parsePace(val) {
  if (!val) return null
  if (String(val).includes(':')) {
    const [m, s] = String(val).split(':').map(Number)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const n = parseInt(val, 10); return isNaN(n) ? null : n
}
function metricsToForm(data) {
  if (!data) return { max_hr: '', resting_hr: '', lthr: '', threshold_pace_sec_km: '', ftp_watts: '', css_per_100m_sec: '', vo2max: '' }
  return {
    max_hr:                data.max_hr               ?? '',
    resting_hr:            data.resting_hr            ?? '',
    lthr:                  data.lthr                  ?? '',
    threshold_pace_sec_km: data.threshold_pace_sec_km != null ? secsToMinSec(data.threshold_pace_sec_km) : '',
    ftp_watts:             data.ftp_watts             ?? '',
    css_per_100m_sec:      data.css_per_100m_sec      != null ? secsToMinSec(data.css_per_100m_sec)      : '',
    vo2max:                data.vo2max                ?? '',
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage({ onProviderChange }) {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('performance')

  const [profile,       setProfile]       = useState(null)
  const [stravaConn,    setStravaConn]    = useState(null)
  const [whoopConn,     setWhoopConn]     = useState(null)
  const [loading,       setLoading]       = useState(true)

  const [confirming,    setConfirming]    = useState(null)   // null | 'strava' | 'whoop'
  const [disconnecting, setDisconnecting] = useState(null)
  const [importing,     setImporting]     = useState(null)   // null | 'strava' | 'whoop'
  const [importResult,  setImportResult]  = useState(null)
  const [deletingAll,   setDeletingAll]   = useState(false)
  const [confirmDel,    setConfirmDel]    = useState(false)
  const [error,         setError]         = useState(null)

  // Profile edit
  const [isEditing,  setIsEditing]  = useState(false)
  const [editName,   setEditName]   = useState('')
  const [savingName, setSavingName] = useState(false)
  const avatarInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      getStravaConnection().catch(() => null),
      getWhoopConnection().catch(() => null),
    ]).then(([profileRes, strava, whoop]) => {
      setProfile(profileRes.data)
      setStravaConn(strava)
      setWhoopConn(whoop)
      setLoading(false)
    })
  }, [user])

  async function refreshConns() {
    const [strava, whoop] = await Promise.all([
      getStravaConnection().catch(() => null),
      getWhoopConnection().catch(() => null),
    ])
    setStravaConn(strava); setWhoopConn(whoop)
    onProviderChange?.()
  }

  async function handleDisconnect(provider) {
    if (confirming !== provider) { setConfirming(provider); return }
    setDisconnecting(provider); setError(null)
    try {
      if (provider === 'strava') await disconnectStravaData()
      else                       await disconnectWhoopData()
      await refreshConns()
    } catch (err) {
      setError(`Failed to disconnect ${provider}: ${err.response?.data?.error || err.message}`)
    } finally { setDisconnecting(null); setConfirming(null) }
  }

  async function handleImportRecent(provider) {
    setImporting(provider); setImportResult(null); setError(null)
    try {
      const result = provider === 'strava' ? await importStravaRecent() : await importWhoopRecent()
      setImportResult({ provider, count: result.imported ?? result.count ?? 0 })
      await refreshConns()
    } catch (err) {
      setError(`Import failed: ${err.response?.data?.error || err.message}`)
    } finally { setImporting(null) }
  }

  async function handleDeleteAllData() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeletingAll(true); setError(null)
    try {
      await deleteAllUserData()
      await refreshConns()
    } catch (err) {
      setError(`Delete failed: ${err.response?.data?.error || err.message}`)
    } finally { setDeletingAll(false); setConfirmDel(false) }
  }

  async function handleSaveName() {
    const trimmed = editName.trim(); if (!trimmed) return
    setSavingName(true)
    await supabase.from('profiles').update({ full_name: trimmed, updated_at: new Date().toISOString() }).eq('id', user.id)
    setProfile(p => ({ ...p, full_name: trimmed }))
    setSavingName(false); setIsEditing(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: urlData?.publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id)
      setProfile(p => ({ ...p, avatar_url: urlData?.publicUrl }))
    }
    setUploadingAvatar(false)
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <PageLoader />

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Athlete'

  return (
    <div style={pageWrap}>

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg,#e04e1f,#f47c20)',
        borderRadius: 20, padding: '24px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div
          style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => avatarInputRef.current?.click()}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            border: '3px solid rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {uploadingAvatar ? (
              <span style={{ fontSize: 11, color: '#fff' }}>…</span>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', border: '2px solid #e04e1f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
          }}>📷</div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>{displayName}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{user?.email}</div>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 14, padding: 4, gap: 4 }}>
        {[['performance', 'Performance'], ['providers', 'Providers'], ['account', 'Account']].map(([key, label]) => (
          <button
            key={key} onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: activeTab === key ? '#fff' : 'transparent',
              color: activeTab === key ? '#1A1B23' : '#9CA3AF',
              boxShadow: activeTab === key ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Performance ── */}
      {activeTab === 'performance' && (
        <PerformanceTab userId={user?.id} />
      )}

      {/* ── Tab: Providers ── */}
      {activeTab === 'providers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <ProviderCard
            label="Strava" emoji="🟠" color="#FC4C02"
            conn={stravaConn}
            confirming={confirming === 'strava'}
            disconnecting={disconnecting === 'strava'}
            importing={importing === 'strava'}
            importResult={importResult?.provider === 'strava' ? importResult : null}
            fmtDate={fmtDate}
            onConnect={connectStrava}
            onDisconnect={() => handleDisconnect('strava')}
            onCancelConfirm={() => setConfirming(null)}
            onImportRecent={() => handleImportRecent('strava')}
          />

          <ProviderCard
            label="WHOOP" emoji="🟢" color="#0ABFBC"
            conn={whoopConn}
            confirming={confirming === 'whoop'}
            disconnecting={disconnecting === 'whoop'}
            importing={importing === 'whoop'}
            importResult={importResult?.provider === 'whoop' ? importResult : null}
            fmtDate={fmtDate}
            onConnect={connectWhoop}
            onDisconnect={() => handleDisconnect('whoop')}
            onCancelConfirm={() => setConfirming(null)}
            onImportRecent={() => handleImportRecent('whoop')}
          />
        </div>
      )}

      {/* ── Tab: Account ── */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Name */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 12 }}>
              Profile
            </div>
            {isEditing ? (
              <div>
                <input
                  value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                  style={inputStyle} autoFocus maxLength={80}
                  placeholder="Your name"
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={handleSaveName} disabled={savingName || !editName.trim()} style={primaryBtnSm}>
                    {savingName ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setIsEditing(false)} style={secondaryBtnSm}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1B23' }}>{displayName}</div>
                  <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{user?.email}</div>
                </div>
                <button onClick={() => { setEditName(displayName); setIsEditing(true) }} style={editBtn}>Edit</button>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button onClick={signOut} style={{
            ...card, border: '1px solid #EAECF0', textAlign: 'left',
            width: '100%', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 700, color: '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            Sign out <span style={{ fontSize: 18, color: '#9CA3AF' }}>→</span>
          </button>

          {/* Delete all data */}
          <div style={{ ...card, borderColor: '#FECACA' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#EF4444', marginBottom: 10 }}>
              Danger Zone
            </div>
            {confirmDel ? (
              <div>
                <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 1.5 }}>
                  This will permanently delete all your activities, metrics, training plans, and connections. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleDeleteAllData} disabled={deletingAll} style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                    background: '#DC2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: 700, opacity: deletingAll ? 0.6 : 1,
                  }}>
                    {deletingAll ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                  <button onClick={() => setConfirmDel(false)} style={secondaryBtnSm}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={handleDeleteAllData} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1px solid #FECACA', background: '#FEF2F2',
                color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700,
              }}>
                Delete all data from ZONE
              </button>
            )}
            {error && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 10 }}>{error}</div>}
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}

// ── PerformanceTab ─────────────────────────────────────────────────────────────

const METRIC_COLS = 'max_hr,resting_hr,lthr,threshold_pace_sec_km,ftp_watts,css_per_100m_sec,vo2max'

function PerformanceTab({ userId }) {
  const [metrics,      setMetrics]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [isEditing,    setIsEditing]    = useState(false)
  const [form,         setForm]         = useState(metricsToForm(null))
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState(null)
  const [detecting,    setDetecting]    = useState(false)
  const [detectResult, setDetectResult] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select(METRIC_COLS).eq('id', userId).maybeSingle()
      .then(({ data }) => { setMetrics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  function startEdit() { setForm(metricsToForm(metrics)); setSaveErr(null); setDetectResult(null); setIsEditing(true) }

  async function handleAutoDetect() {
    setDetecting(true); setDetectResult(null)
    try {
      const { suggested, sources, has_whoop, has_strava } = await fetchAutoDetectedMetrics(userId)
      const base   = isEditing ? form : metricsToForm(metrics)
      const merged = { ...base }
      if (suggested.max_hr != null)               merged.max_hr               = suggested.max_hr
      if (suggested.resting_hr != null)            merged.resting_hr            = suggested.resting_hr
      if (suggested.threshold_pace_sec_km != null) merged.threshold_pace_sec_km = secsToMinSec(suggested.threshold_pace_sec_km)
      setForm(merged); setDetectResult({ sources, has_whoop, has_strava }); setIsEditing(true)
    } catch (err) { setDetectResult({ error: err.message }) }
    finally { setDetecting(false) }
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null)
    try {
      const payload = {
        max_hr:                form.max_hr               !== '' ? parseInt(form.max_hr, 10)    || null : null,
        resting_hr:            form.resting_hr            !== '' ? parseInt(form.resting_hr, 10) || null : null,
        lthr:                  form.lthr                  !== '' ? parseInt(form.lthr, 10)       || null : null,
        threshold_pace_sec_km: form.threshold_pace_sec_km !== '' ? parsePace(form.threshold_pace_sec_km) : null,
        ftp_watts:             form.ftp_watts             !== '' ? parseInt(form.ftp_watts, 10)  || null : null,
        css_per_100m_sec:      form.css_per_100m_sec      !== '' ? parsePace(form.css_per_100m_sec)      : null,
        vo2max:                form.vo2max                !== '' ? parseFloat(form.vo2max)       || null : null,
        updated_at:            new Date().toISOString(),
      }
      const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select(METRIC_COLS).single()
      if (error) throw error
      setMetrics(data); setDetectResult(null); setIsEditing(false)
    } catch (err) { setSaveErr(`Could not save: ${err.message}`) }
    finally { setSaving(false) }
  }

  const hrZones    = computeHRZones(metrics?.max_hr, metrics?.lthr)
  const runZones   = computeRunZones(metrics?.threshold_pace_sec_km)
  const powerZones = computePowerZones(metrics?.ftp_watts)
  const hasAny     = metrics && METRIC_COLS.split(',').some(k => metrics[k] != null)

  if (loading) return <PageLoader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Auto-detect + edit buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleAutoDetect} disabled={detecting} style={{
          flex: 1, padding: '11px', borderRadius: 12,
          border: '1px solid #fdd0b5', background: '#FFF3EE', color: '#e04e1f',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          opacity: detecting ? 0.6 : 1,
        }}>
          {detecting ? 'Detecting…' : '↻ Auto-detect from apps'}
        </button>
        {!isEditing && (
          <button onClick={startEdit} style={editBtn}>
            {hasAny ? 'Edit' : 'Add metrics'}
          </button>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>
            Performance Metrics
          </div>

          {detectResult && !detectResult.error && (
            <div style={{ background: '#FFF3EE', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e04e1f', marginBottom: 4 }}>Auto-detected values:</div>
              {Object.entries(detectResult.sources).map(([key, src]) => {
                if (!src) return null
                const labels = { max_hr: 'Max HR', resting_hr: 'Resting HR', threshold_pace_sec_km: 'Threshold Pace' }
                return <div key={key} style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>· {labels[key]}: {src}</div>
              })}
            </div>
          )}
          {detectResult?.error && <ErrorBanner>{detectResult.error}</ErrorBanner>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              ['Max HR', 'max_hr', 'number', 'e.g. 185', 'bpm'],
              ['Resting HR', 'resting_hr', 'number', 'e.g. 48', 'bpm'],
              ['LTHR', 'lthr', 'number', 'e.g. 162', 'bpm'],
              ['Threshold Pace', 'threshold_pace_sec_km', 'text', 'e.g. 5:00', '/km'],
              ['FTP', 'ftp_watts', 'number', 'e.g. 230', 'W'],
              ['CSS', 'css_per_100m_sec', 'text', 'e.g. 1:45', '/100m'],
              ['VO2max', 'vo2max', 'number', 'e.g. 52', 'ml/kg/min'],
            ].map(([label, field, type, placeholder, unit]) => (
              <div key={field}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                  {label} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{unit}</span>
                </label>
                <input
                  type={type} value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder} style={{ ...inputStyle, fontSize: 14 }}
                  min={type === 'number' ? 0 : undefined}
                />
              </div>
            ))}
          </div>

          {saveErr && <ErrorBanner>{saveErr}</ErrorBanner>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryBtnSm}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setIsEditing(false); setDetectResult(null) }} style={secondaryBtnSm}>Cancel</button>
          </div>
        </div>
      )}

      {/* Display metrics */}
      {!isEditing && !hasAny && (
        <div style={{ ...card, textAlign: 'center', padding: '32px 20px', color: '#9CA3AF' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23', marginBottom: 6 }}>No metrics yet</div>
          <div style={{ fontSize: 13 }}>Add your max HR, FTP, or threshold pace to see personalised training zones.</div>
        </div>
      )}

      {!isEditing && hasAny && (
        <>
          {/* Raw values */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>
              Your Metrics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {metrics.max_hr           && <MetricDisplay label="Max HR"        value={`${metrics.max_hr} bpm`} />}
              {metrics.resting_hr       && <MetricDisplay label="Resting HR"    value={`${metrics.resting_hr} bpm`} />}
              {metrics.lthr             && <MetricDisplay label="LTHR"          value={`${metrics.lthr} bpm`} />}
              {metrics.threshold_pace_sec_km && <MetricDisplay label="Threshold Pace" value={fmtPace(metrics.threshold_pace_sec_km)} />}
              {metrics.ftp_watts        && <MetricDisplay label="FTP"           value={`${metrics.ftp_watts} W`} />}
              {metrics.css_per_100m_sec && <MetricDisplay label="CSS"           value={fmtSwimPace(metrics.css_per_100m_sec)} />}
              {metrics.vo2max           && <MetricDisplay label="VO2max"        value={`${metrics.vo2max} ml/kg/min`} />}
            </div>
          </div>

          {/* HR Zones */}
          {hrZones && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>
                HR Zones <span style={{ fontWeight: 400, textTransform: 'none', color: '#9CA3AF' }}>({metrics.lthr ? 'LTHR-based' : '% max HR'})</span>
              </div>
              {hrZones.map((z, i) => <ZoneRow key={z.name} zone={z} unit="bpm" i={i} />)}
            </div>
          )}

          {/* Run Zones */}
          {runZones && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>Run Pace Zones</div>
              {runZones.map((z, i) => (
                <div key={z.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 13, color: ZONE_COLORS[i] || '#9CA3AF', fontWeight: 700 }}>{z.name}</span>
                  <span style={{ fontSize: 13, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                    {z.lo != null && z.hi != null ? `${fmtPace(z.hi)} – ${fmtPace(z.lo)}` :
                     z.lo == null ? `< ${fmtPace(z.hi)}` : `> ${fmtPace(z.lo)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Power Zones */}
          {powerZones && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>Power Zones (FTP: {metrics.ftp_watts}W)</div>
              {powerZones.map((z, i) => <ZoneRow key={z.name} zone={z} unit="W" i={i} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({ label, emoji, color, conn, confirming, disconnecting, importing, importResult, fmtDate, onConnect, onDisconnect, onCancelConfirm, onImportRecent }) {
  const connected = !!conn?.connected

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1B23' }}>{label}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: connected ? '#D1FAE5' : '#FEF2F2',
              color: connected ? '#059669' : '#DC2626',
            }}>
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
            {conn?.lastSyncedAt ? `Last synced ${fmtDate(conn.lastSyncedAt)}` : 'Never synced'}
          </div>
        </div>
      </div>

      {!connected ? (
        <button onClick={onConnect} style={{
          width: '100%', padding: '12px', borderRadius: 12, border: 'none',
          background: color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: 700,
        }}>
          Connect {label}
        </button>
      ) : confirming ? (
        <div>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>
            This will stop future {label} syncs. Your existing data is preserved.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDisconnect} disabled={disconnecting} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none',
              background: '#DC2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 700, opacity: disconnecting ? 0.6 : 1,
            }}>
              {disconnecting ? 'Disconnecting…' : 'Confirm disconnect'}
            </button>
            <button onClick={onCancelConfirm} style={secondaryBtnSm}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onImportRecent} disabled={importing} style={{
            flex: 1, padding: '11px', borderRadius: 12,
            border: `1px solid ${color}44`, background: `${color}10`, color: color,
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            opacity: importing ? 0.6 : 1,
          }}>
            {importing ? 'Importing…' : 'Import last 10 days'}
          </button>
          {importResult && (
            <div style={{ width: '100%', fontSize: 12, color: '#059669', fontWeight: 600 }}>
              ✓ {importResult.count} records imported
            </div>
          )}
          <button onClick={onDisconnect} style={{
            flex: 'none', padding: '11px 16px', borderRadius: 12,
            border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function ZoneRow({ zone, unit, i }) {
  const lo = zone.lo != null ? zone.lo : '—'
  const hi = zone.hi != null ? zone.hi : '—'
  const range = zone.lo != null && zone.hi != null
    ? `${lo} – ${hi} ${unit}`
    : zone.lo != null ? `> ${lo} ${unit}` : `< ${hi} ${unit}`
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 13, color: ZONE_COLORS[i] || '#9CA3AF', fontWeight: 700 }}>{zone.name}</span>
      <span style={{ fontSize: 13, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{range}</span>
    </div>
  )
}

function MetricDisplay({ label, value }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ErrorBanner({ children }) {
  return (
    <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #EAECF0', borderTopColor: '#e04e1f', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageWrap = { padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }

const card = {
  background: '#fff', borderRadius: 20, border: '1px solid #EAECF0',
  padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #EAECF0', borderRadius: 10,
  background: '#F9FAFB', color: '#1A1B23',
  fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const editBtn = {
  padding: '7px 14px', borderRadius: 10,
  border: '1px solid #EAECF0', background: '#F9FAFB', color: '#6B7280',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, flexShrink: 0,
}

const primaryBtnSm = {
  flex: 1, padding: '11px', borderRadius: 12, border: 'none',
  background: '#e04e1f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 14, fontWeight: 700,
}

const secondaryBtnSm = {
  padding: '11px 16px', borderRadius: 12, border: '1px solid #EAECF0',
  background: '#F9FAFB', color: '#6B7280', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
}
