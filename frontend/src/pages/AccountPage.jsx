/**
 * AccountPage — Route: /account
 *
 * Shows:
 *   1. Profile info from Supabase profiles table + auth identity
 *   2. Provider connection status (Strava, WHOOP) with last-sync time
 *   3. Disconnect + data-delete flow for each provider (server-side, with confirm)
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ── Auto-detect performance metrics from Supabase tables ──────────────────────
async function fetchAutoDetectedMetrics(userId) {
  // Run all three queries in parallel
  const [maxHrRes, featuresRes, runRes] = await Promise.all([
    // 1. All-time max HR across every activity
    supabase
      .from('activities')
      .select('max_hr')
      .eq('user_id', userId)
      .not('max_hr', 'is', null)
      .order('max_hr', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 2. Latest derived features row — has resting HR average and provider flags
    supabase
      .from('derived_training_features')
      .select('avg_resting_hr_28d, has_whoop, has_strava')
      .eq('user_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 3. All qualifying run activities (20–75 min, faster than walking)
    supabase
      .from('activities')
      .select('avg_speed_mps')
      .eq('user_id', userId)
      .in('sport_type', ['Run', 'TrailRun', 'VirtualRun'])
      .not('avg_speed_mps', 'is', null)
      .gte('moving_time_s', 1200)
      .lte('moving_time_s', 4500),
  ])

  const maxHrRow  = maxHrRes.data
  const features  = featuresRes.data
  const runs      = (runRes.data || []).filter(r => Number(r.avg_speed_mps) > 1.5)

  // 80th-percentile pace from qualifying runs (requires ≥ 3)
  let thresholdPaceSecKm = null
  if (runs.length >= 3) {
    const speeds = runs.map(r => Number(r.avg_speed_mps)).sort((a, b) => a - b)
    const idx    = Math.min(Math.floor(speeds.length * 0.80), speeds.length - 1)
    thresholdPaceSecKm = Math.round(1000 / speeds[idx])
  }

  const suggested = {
    max_hr:                maxHrRow?.max_hr != null ? Math.round(Number(maxHrRow.max_hr)) : null,
    resting_hr:            features?.avg_resting_hr_28d != null ? Math.round(Number(features.avg_resting_hr_28d)) : null,
    threshold_pace_sec_km: thresholdPaceSecKm,
  }

  const sources = {
    max_hr:                suggested.max_hr != null                ? 'all-time max from synced activities' : null,
    resting_hr:            suggested.resting_hr != null            ? 'WHOOP 28-day average resting HR'    : null,
    threshold_pace_sec_km: suggested.threshold_pace_sec_km != null ? `80th-percentile pace (${runs.length} runs, 20–75 min)` : null,
  }

  return {
    suggested,
    sources,
    has_whoop:  features?.has_whoop  ?? false,
    has_strava: features?.has_strava ?? false,
  }
}
import {
  getStravaConnection,
  getWhoopConnection,
  disconnectStravaData,
  disconnectWhoopData,
  connectStrava,
  connectWhoop,
} from '../utils/api'
import { PageWrapper } from '../components/ui'

export default function AccountPage({ onProviderChange }) {
  const { user, signOut } = useAuth()

  const [profile,       setProfile]       = useState(null)
  const [stravaConn,    setStravaConn]    = useState(null)
  const [whoopConn,     setWhoopConn]     = useState(null)
  const [loading,       setLoading]       = useState(true)

  // confirming: null | 'strava' | 'whoop'
  const [confirming,    setConfirming]    = useState(null)
  const [disconnecting, setDisconnecting] = useState(null)
  const [error,         setError]         = useState(null)

  // Edit mode
  const [isEditing,   setIsEditing]   = useState(false)
  const [editName,    setEditName]     = useState('')
  const [savingName,  setSavingName]   = useState(false)
  const [nameError,   setNameError]    = useState(null)

  // Avatar upload
  const avatarInputRef              = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError,     setAvatarError]     = useState(null)

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

  async function handleDisconnect(provider) {
    if (confirming !== provider) {
      setConfirming(provider)
      return
    }
    setDisconnecting(provider)
    setError(null)
    try {
      if (provider === 'strava') await disconnectStravaData()
      else                       await disconnectWhoopData()
      // Refresh connection status
      const [strava, whoop] = await Promise.all([
        getStravaConnection().catch(() => null),
        getWhoopConnection().catch(() => null),
      ])
      setStravaConn(strava)
      setWhoopConn(whoop)
      onProviderChange?.()
    } catch (err) {
      setError(`Failed to disconnect ${provider}: ${err.response?.data?.error || err.message}`)
    } finally {
      setDisconnecting(null)
      setConfirming(null)
    }
  }

  function startEdit() {
    setEditName(profile?.full_name || displayName || '')
    setNameError(null)
    setIsEditing(true)
  }

  async function handleSaveName() {
    const trimmed = editName.trim()
    if (!trimmed) return
    setSavingName(true)
    setNameError(null)
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ full_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (dbErr) {
      setNameError('Could not save. Please try again.')
      setSavingName(false)
      return
    }
    setProfile(p => ({ ...p, full_name: trimmed }))
    setSavingName(false)
    setIsEditing(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarError(null)
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) {
      setAvatarError('Upload failed. Please try again.')
      setUploadingAvatar(false)
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData?.publicUrl
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    setUploadingAvatar(false)
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { url: publicUrl } }))
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return null

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '—'

  return (
    <PageWrapper>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

      {/* ── Top row: account + providers side by side ── */}
      <div style={s.pageGrid}>

        {/* ── Profile card ── */}
        <section style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ ...s.cardTitle, margin: 0 }}>Account</h2>
            {!isEditing && (
              <button onClick={startEdit} style={s.editBtn}>Edit</button>
            )}
          </div>

          {/* Avatar — click to upload */}
          <div style={{ position: 'relative', width: 56, marginBottom: 20 }}>
            <div
              style={{ ...s.avatar, cursor: 'pointer' }}
              onClick={() => avatarInputRef.current?.click()}
              title="Change photo"
            >
              {uploadingAvatar ? (
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>…</span>
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={s.avatarImg} />
              ) : (
                <span style={s.avatarInitial}>{displayName[0]?.toUpperCase()}</span>
              )}
            </div>
            {/* Camera icon overlay */}
            <div style={s.cameraOverlay} onClick={() => avatarInputRef.current?.click()}>
              <CameraIcon />
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          {avatarError && <p style={{ ...s.errorMsg, marginBottom: 8 }}>{avatarError}</p>}

          <div style={s.fieldList}>
            {isEditing ? (
              <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <label style={s.fieldLabel}>Name</label>
                <input
                  style={s.editInput}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditing(false) }}
                  autoFocus
                  maxLength={80}
                />
                {nameError && <p style={{ fontSize: 11, color: 'var(--bad)', margin: '4px 0 0' }}>{nameError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !editName.trim()}
                    style={{ ...s.actionBtnSmall, background: 'var(--accent)', color: '#fff', border: 'none', opacity: savingName || !editName.trim() ? 0.6 : 1 }}
                  >
                    {savingName ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setIsEditing(false)} style={{ ...s.actionBtnSmall, ...s.cancelBtnSm }}>Cancel</button>
                </div>
              </div>
            ) : (
              <Field label="Name" value={profile?.full_name || displayName} />
            )}
            <Field label="Email"     value={user?.email} />
            <Field label="Signed up" value={fmtDate(user?.created_at)} />
          </div>

          <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
        </section>

        {/* ── Provider connections ── */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>Connected Providers</h2>

          <ProviderRow
            label="Strava"
            color="var(--accent)"
            conn={stravaConn}
            confirming={confirming === 'strava'}
            disconnecting={disconnecting === 'strava'}
            fmtDate={fmtDate}
            onConnect={connectStrava}
            onDisconnect={() => handleDisconnect('strava')}
            onCancelConfirm={() => setConfirming(null)}
          />

          <div style={s.divider} />

          <ProviderRow
            label="WHOOP"
            color="var(--whoop)"
            conn={whoopConn}
            confirming={confirming === 'whoop'}
            disconnecting={disconnecting === 'whoop'}
            fmtDate={fmtDate}
            onConnect={connectWhoop}
            onDisconnect={() => handleDisconnect('whoop')}
            onCancelConfirm={() => setConfirming(null)}
          />

          {error && <p style={s.errorMsg}>{error}</p>}
        </section>

      </div>

      {/* ── Bottom: full-width performance metrics ── */}
      <PerformanceMetricsCard />

      </div>
    </PageWrapper>
  )
}

// ── Performance Metrics Card ──────────────────────────────────────────────────

// Format seconds/km as "M:SS /km"
function fmtPace(secPerKm) {
  if (!secPerKm) return null
  const m = Math.floor(secPerKm / 60)
  const s = String(secPerKm % 60).padStart(2, '0')
  return `${m}:${s} /km`
}

// Format seconds/100m as "M:SS /100m"
function fmtSwimPace(sec) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s} /100m`
}

// Compute HR zones from either LTHR or max_hr
function computeHRZones(maxHr, lthr, restingHr) {
  if (lthr) {
    // LTHR-based zones (Friel method)
    return [
      { name: 'Z1 — Recovery',   lo: Math.round(lthr * 0.00), hi: Math.round(lthr * 0.85) },
      { name: 'Z2 — Aerobic',    lo: Math.round(lthr * 0.85), hi: Math.round(lthr * 0.89) },
      { name: 'Z3 — Tempo',      lo: Math.round(lthr * 0.90), hi: Math.round(lthr * 0.94) },
      { name: 'Z4 — Threshold',  lo: Math.round(lthr * 0.95), hi: Math.round(lthr * 0.99) },
      { name: 'Z5 — VO2max+',    lo: Math.round(lthr * 1.00), hi: maxHr || Math.round(lthr * 1.06) },
    ]
  }
  if (maxHr) {
    // % max HR zones
    return [
      { name: 'Z1 — Recovery',   lo: 0,                       hi: Math.round(maxHr * 0.60) },
      { name: 'Z2 — Aerobic',    lo: Math.round(maxHr * 0.60), hi: Math.round(maxHr * 0.70) },
      { name: 'Z3 — Tempo',      lo: Math.round(maxHr * 0.70), hi: Math.round(maxHr * 0.80) },
      { name: 'Z4 — Threshold',  lo: Math.round(maxHr * 0.80), hi: Math.round(maxHr * 0.90) },
      { name: 'Z5 — VO2max+',    lo: Math.round(maxHr * 0.90), hi: maxHr },
    ]
  }
  return null
}

// Compute run pace zones from threshold pace
function computeRunZones(thresholdSecKm) {
  if (!thresholdSecKm) return null
  const t = thresholdSecKm
  return [
    { name: 'Z1 — Recovery',  lo: t + 90,  hi: null },
    { name: 'Z2 — Aerobic',   lo: t + 45,  hi: t + 90 },
    { name: 'Z3 — Tempo',     lo: t + 15,  hi: t + 45 },
    { name: 'Z4 — Threshold', lo: t - 5,   hi: t + 15 },
    { name: 'Z5 — VO2max',    lo: null,    hi: t - 5  },
  ]
}

// Compute FTP power zones (Coggan)
function computePowerZones(ftp) {
  if (!ftp) return null
  return [
    { name: 'Z1 — Active Recovery', lo: 0,                     hi: Math.round(ftp * 0.55) },
    { name: 'Z2 — Endurance',       lo: Math.round(ftp * 0.55), hi: Math.round(ftp * 0.75) },
    { name: 'Z3 — Tempo',           lo: Math.round(ftp * 0.75), hi: Math.round(ftp * 0.90) },
    { name: 'Z4 — Threshold',       lo: Math.round(ftp * 0.90), hi: Math.round(ftp * 1.05) },
    { name: 'Z5 — VO2max',          lo: Math.round(ftp * 1.05), hi: Math.round(ftp * 1.20) },
    { name: 'Z6 — Anaerobic',       lo: Math.round(ftp * 1.20), hi: null },
  ]
}

const ZONE_COLORS = [
  'var(--text-dim)',       // Z1 grey
  '#3b9eff',              // Z2 blue
  '#f59e0b',              // Z3 amber
  '#f97316',              // Z4 orange
  '#ef4444',              // Z5 red
  '#9333ea',              // Z6 purple (power only)
]

function ZoneRow({ zone, unit, idx }) {
  const lo = zone.lo != null ? zone.lo : '—'
  const hi = zone.hi != null ? zone.hi : '—'
  const range = zone.lo != null && zone.hi != null
    ? `${lo} – ${hi} ${unit}`
    : zone.lo != null
      ? `> ${lo} ${unit}`
      : `< ${hi} ${unit}`
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: ZONE_COLORS[idx] ?? 'var(--text-muted)', fontWeight: 600 }}>{zone.name}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{range}</span>
    </div>
  )
}

const METRICS_DEFAULTS = {
  max_hr: '',
  resting_hr: '',
  lthr: '',
  threshold_pace_sec_km: '',
  ftp_watts: '',
  css_per_100m_sec: '',
  vo2max: '',
}

// Convert seconds to "M:SS" string for the pace input fields
function secsToMinSec(sec) {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function metricsToForm(data) {
  if (!data) return { ...METRICS_DEFAULTS }
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

// Pace string "M:SS" → total seconds, or return raw number
function parsePace(val) {
  if (val === '' || val == null) return null
  if (typeof val === 'string' && val.includes(':')) {
    const [m, s] = val.split(':').map(Number)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function PerformanceMetricsCard() {
  const { user } = useAuth()
  const [metrics,      setMetrics]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [isEditing,    setIsEditing]    = useState(false)
  const [form,         setForm]         = useState({ ...METRICS_DEFAULTS })
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState(null)
  const [detecting,    setDetecting]    = useState(false)
  const [detectResult, setDetectResult] = useState(null)  // { sources, has_whoop, has_strava }

  const METRIC_COLS = 'max_hr,resting_hr,lthr,threshold_pace_sec_km,ftp_watts,css_per_100m_sec,vo2max'

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select(METRIC_COLS)
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => { setMetrics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  function startEdit() {
    setForm(metricsToForm(metrics))
    setSaveErr(null)
    setDetectResult(null)
    setIsEditing(true)
  }

  async function handleAutoDetect() {
    setDetecting(true)
    setDetectResult(null)
    try {
      const { suggested, sources, has_whoop, has_strava } = await fetchAutoDetectedMetrics(user.id)

      // Merge auto-detected values into form (keeps existing manual values for un-detectable fields)
      const base   = isEditing ? form : metricsToForm(metrics)
      const merged = { ...base }
      if (suggested.max_hr != null)               merged.max_hr               = suggested.max_hr
      if (suggested.resting_hr != null)            merged.resting_hr            = suggested.resting_hr
      if (suggested.threshold_pace_sec_km != null) merged.threshold_pace_sec_km = secsToMinSec(suggested.threshold_pace_sec_km)

      setForm(merged)
      setDetectResult({ sources, has_whoop, has_strava })
      setIsEditing(true)
    } catch (err) {
      setDetectResult({ error: `Detection failed: ${err.message}` })
    } finally {
      setDetecting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
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
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select(METRIC_COLS)
        .single()
      if (error) throw error
      setMetrics(data)
      setDetectResult(null)
      setIsEditing(false)
    } catch (err) {
      setSaveErr(`Could not save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const hrZones    = computeHRZones(metrics?.max_hr, metrics?.lthr, metrics?.resting_hr)
  const runZones   = computeRunZones(metrics?.threshold_pace_sec_km)
  const powerZones = computePowerZones(metrics?.ftp_watts)
  const hasAnyMetric = metrics && METRIC_COLS.split(',').some(k => metrics[k] != null)

  return (
    <section style={s.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...s.cardTitle, margin: 0 }}>Performance Metrics</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleAutoDetect}
            disabled={detecting || loading}
            style={{ ...pm.autoBtn, opacity: detecting || loading ? 0.6 : 1 }}
          >
            {detecting ? 'Detecting…' : '↻ Regenerate from connected apps'}
          </button>
          {!isEditing && !loading && (
            <button onClick={startEdit} style={s.editBtn}>
              {metrics ? 'Edit' : 'Add metrics'}
            </button>
          )}
        </div>
      </div>

      {loading ? null : isEditing ? (
        /* ── Edit form ── */
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>
            These values personalise your training plan zones and session intensity targets.
            Leave any field blank to skip.
          </p>

          {/* Auto-detection result banner */}
          {detectResult && !detectResult.error && (
            <div style={pm.detectBanner}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>
                Values filled from your connected apps:
              </p>
              {Object.entries(detectResult.sources).map(([key, src]) => {
                if (!src) return null
                const labels = {
                  max_hr: 'Max HR',
                  resting_hr: 'Resting HR',
                  threshold_pace_sec_km: 'Threshold Pace',
                }
                return (
                  <div key={key} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, marginBottom: 2 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{labels[key]}</span>
                    <span>— {src}</span>
                  </div>
                )
              })}
              {!detectResult.has_whoop && !detectResult.has_strava && (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  No connected apps found. Connect Strava or WHOOP to enable auto-detection.
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                FTP, LTHR, swim CSS, and VO2max cannot be derived automatically — enter those manually.
              </p>
            </div>
          )}
          {detectResult?.error && (
            <p style={{ ...s.errorMsg, marginBottom: 12 }}>{detectResult.error}</p>
          )}

          <div style={pm.formGrid}>
            <MetricInput label="Max HR" unit="bpm" field="max_hr"
              form={form} setForm={setForm} type="number" placeholder="e.g. 185" />
            <MetricInput label="Resting HR" unit="bpm" field="resting_hr"
              form={form} setForm={setForm} type="number" placeholder="e.g. 48" />
            <MetricInput label="Lactate Threshold HR" unit="bpm" field="lthr"
              form={form} setForm={setForm} type="number" placeholder="e.g. 162"
              hint="More precise than max HR for zone calc" />
            <MetricInput label="Threshold Pace" unit="min/km" field="threshold_pace_sec_km"
              form={form} setForm={setForm} type="text" placeholder="e.g. 5:00"
              hint="Running pace at threshold (M:SS format)" />
            <MetricInput label="FTP" unit="watts" field="ftp_watts"
              form={form} setForm={setForm} type="number" placeholder="e.g. 230"
              hint="Functional Threshold Power (cycling)" />
            <MetricInput label="CSS" unit="per 100m" field="css_per_100m_sec"
              form={form} setForm={setForm} type="text" placeholder="e.g. 1:45"
              hint="Critical Swim Speed (M:SS format)" />
            <MetricInput label="VO2max" unit="ml/kg/min" field="vo2max"
              form={form} setForm={setForm} type="number" placeholder="e.g. 52"
              hint="Optional estimate" />
          </div>

          {saveErr && <p style={{ ...s.errorMsg, marginTop: 12 }}>{saveErr}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ ...s.actionBtnSmall, background: 'var(--accent)', color: '#fff', border: 'none', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setIsEditing(false); setDetectResult(null) }} style={{ ...s.actionBtnSmall, ...s.cancelBtnSm }}>
              Cancel
            </button>
          </div>
        </div>
      ) : !hasAnyMetric ? (
        /* ── Empty state ── */
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)' }}>
          <p style={{ fontSize: 13, marginBottom: 6 }}>No performance metrics set yet.</p>
          <p style={{ fontSize: 12 }}>
            Add your max HR, FTP, or threshold pace to get personalised training zones.
          </p>
        </div>
      ) : (
        /* ── Display: raw values + computed zones ── */
        <div style={pm.displayGrid}>

          {/* Raw inputs */}
          <div>
            <p style={pm.sectionLabel}>Inputs</p>
            {metrics.max_hr           && <Field label="Max HR"            value={`${metrics.max_hr} bpm`} />}
            {metrics.resting_hr       && <Field label="Resting HR"        value={`${metrics.resting_hr} bpm`} />}
            {metrics.lthr             && <Field label="LTHR"              value={`${metrics.lthr} bpm`} />}
            {metrics.threshold_pace_sec_km && <Field label="Threshold Pace" value={fmtPace(metrics.threshold_pace_sec_km)} />}
            {metrics.ftp_watts        && <Field label="FTP"               value={`${metrics.ftp_watts} W`} />}
            {metrics.css_per_100m_sec && <Field label="CSS"               value={fmtSwimPace(metrics.css_per_100m_sec)} />}
            {metrics.vo2max           && <Field label="VO2max est."       value={`${metrics.vo2max} ml/kg/min`} />}
          </div>

          {/* HR Zones */}
          {hrZones && (
            <div>
              <p style={pm.sectionLabel}>
                Heart Rate Zones
                <span style={pm.zoneBasis}>({metrics.lthr ? 'LTHR-based' : '% max HR'})</span>
              </p>
              {hrZones.map((z, i) => <ZoneRow key={z.name} zone={z} unit="bpm" idx={i} />)}
            </div>
          )}

          {/* Run Zones */}
          {runZones && (
            <div>
              <p style={pm.sectionLabel}>Run Pace Zones</p>
              {runZones.map((z, i) => (
                <div key={z.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: ZONE_COLORS[i] ?? 'var(--text-muted)', fontWeight: 600 }}>{z.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {z.lo != null && z.hi != null
                      ? `${fmtPace(z.hi)} – ${fmtPace(z.lo)}`
                      : z.lo == null
                        ? `< ${fmtPace(z.hi)}`
                        : `> ${fmtPace(z.lo)}`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Power Zones */}
          {powerZones && (
            <div>
              <p style={pm.sectionLabel}>Power Zones (FTP: {metrics.ftp_watts}W)</p>
              {powerZones.map((z, i) => <ZoneRow key={z.name} zone={z} unit="W" idx={i} />)}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MetricInput({ label, unit, field, form, setForm, type, placeholder, hint }) {
  return (
    <div style={pm.inputGroup}>
      <label style={pm.inputLabel}>
        {label}
        {unit && <span style={pm.inputUnit}>{unit}</span>}
      </label>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        style={s.editInput}
        min={type === 'number' ? 0 : undefined}
      />
      {hint && <p style={pm.inputHint}>{hint}</p>}
    </div>
  )
}

const pm = {
  autoBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--accent)44',
    background: 'var(--accent)10',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  detectBanner: {
    background: 'var(--accent)0a',
    border: '1px solid var(--accent)28',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px 20px',
  },
  displayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '20px 32px',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    margin: '0 0 8px',
  },
  zoneBasis: {
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 0,
    marginLeft: 6,
    fontSize: 10,
    color: 'var(--text-dim)',
    opacity: 0.7,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  inputLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  inputUnit: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontWeight: 400,
  },
  inputHint: {
    fontSize: 10,
    color: 'var(--text-dim)',
    margin: '1px 0 0',
  },
}

// ── Camera icon ──────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

// ── Provider row ──────────────────────────────────────────────────────────────

function ProviderRow({ label, color, conn, confirming, disconnecting, fmtDate, onConnect, onDisconnect, onCancelConfirm }) {
  const connected = !!conn?.connected

  return (
    <div style={s.providerRow}>
      <div style={s.providerLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...s.dot, background: connected ? color : 'var(--border-hi)', boxShadow: connected ? `0 0 6px ${color}99` : 'none' }} />
          <span style={{ ...s.providerLabel, color: connected ? color : 'var(--text-muted)' }}>{label}</span>
          <span style={{
            ...s.badge,
            background: connected ? color + '14' : 'color-mix(in srgb, var(--bad) 10%, transparent)',
            color: connected ? color : 'var(--bad)',
            border: `1px solid ${connected ? color + '28' : 'color-mix(in srgb, var(--bad) 28%, transparent)'}`,
          }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div style={s.syncMeta}>
          {conn?.lastSyncedAt
            ? <span style={{ color: connected ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                Last synced {fmtDate(conn.lastSyncedAt)}
              </span>
            : <span style={{ color: 'var(--text-dim)' }}>Never synced</span>
          }
          {connected && conn?.connectedAt && (
            <span style={{ opacity: 0.55 }}>· Connected {fmtDate(conn.connectedAt)}</span>
          )}
        </div>
      </div>

      <div style={s.providerActions}>
        {!connected ? (
          <button onClick={onConnect} style={{ ...s.actionBtn, color: color, borderColor: color + '44', background: color + '10' }}>
            Connect
          </button>
        ) : confirming ? (
          // Confirm state — show warning + confirm/cancel
          <div style={s.confirmRow}>
            <span style={s.confirmWarn}>This will delete all synced {label} data.</span>
            <button
              onClick={onDisconnect}
              disabled={disconnecting}
              style={{ ...s.actionBtn, ...s.destructiveBtn }}
            >
              {disconnecting ? 'Removing…' : 'Yes, remove'}
            </button>
            <button onClick={onCancelConfirm} style={s.cancelBtn}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={onDisconnect}
            style={{ ...s.actionBtn, color: 'var(--bad)', borderColor: 'var(--bad)33', background: 'var(--bad-dim)' }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({ label, value, mono, small }) {
  return (
    <div style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <span style={{
        ...s.fieldValue,
        ...(mono ? { fontFamily: 'monospace', fontSize: small ? 10 : 12, color: 'var(--text-muted)' } : {}),
        ...(small ? { fontSize: 11 } : {}),
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  pageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 18,
    padding: '28px 28px 24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    margin: '0 0 20px',
  },
  avatar: {
    width: 56, height: 56,
    borderRadius: '50%',
    overflow: 'hidden',
    marginBottom: 20,
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--accent)14',
  },
  avatarImg: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  avatarInitial: {
    fontSize: 22, fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.02em',
  },
  fieldList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    flex: 1,
  },
  field: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    padding: '9px 0',
    borderBottom: '1px solid var(--border)',
  },
  fieldLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
    flexShrink: 0,
  },
  fieldValue: {
    fontSize: 13,
    color: 'var(--text)',
    fontWeight: 500,
    textAlign: 'right',
    wordBreak: 'break-all',
  },
  editBtn: {
    padding: '5px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  editInput: {
    width: '100%',
    marginTop: 6,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border-hi)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 13, fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  actionBtnSmall: {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cancelBtnSm: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0, right: -2,
    width: 20, height: 20,
    borderRadius: '50%',
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  signOutBtn: {
    marginTop: 20,
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  providerRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px 0',
  },
  providerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  dot: {
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
  },
  providerLabel: {
    fontSize: 13, fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  badge: {
    fontSize: 10, fontWeight: 600,
    padding: '2px 8px', borderRadius: 999,
    letterSpacing: '0.02em',
  },
  syncMeta: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    color: 'var(--text-dim)',
    paddingLeft: 15,
    flexWrap: 'wrap',
  },
  providerActions: {
    paddingLeft: 15,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  confirmWarn: {
    fontSize: 11,
    color: 'var(--bad)',
    fontWeight: 500,
  },
  actionBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  destructiveBtn: {
    color: 'var(--bad)',
    borderColor: 'var(--bad)',
    background: 'var(--bad-dim)',
  },
  cancelBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '0',
  },
  errorMsg: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--bad)',
    background: 'var(--bad-dim)',
    border: '1px solid var(--bad)44',
    borderRadius: 8,
    padding: '8px 12px',
  },
}
