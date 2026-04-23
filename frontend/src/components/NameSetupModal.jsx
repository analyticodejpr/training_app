/**
 * NameSetupModal — shown once after first login when profiles.full_name is null.
 * Pre-fills with the name from Google OAuth metadata.
 * On confirm, writes full_name to the profiles table.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function NameSetupModal({ user, onDone }) {
  const googleName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    ''

  const [name,    setName]    = useState(googleName)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  async function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ full_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (dbErr) {
      setError('Could not save name. Please try again.')
      setSaving(false)
      return
    }
    onDone()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onDone()
  }

  return (
    /* Backdrop */
    <div style={s.backdrop} onClick={onDone}>
      {/* Modal — stop propagation so clicking inside doesn't close */}
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <p style={s.eyebrow}>Welcome</p>
        <h2 style={s.title}>Is this your name?</h2>
        <p style={s.sub}>
          This will appear on your profile. You can change it any time in Account settings.
        </p>

        <input
          style={s.input}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Your name"
          maxLength={80}
        />

        {error && <p style={s.error}>{error}</p>}

        <div style={s.actions}>
          <button
            onClick={handleConfirm}
            disabled={saving || !name.trim()}
            style={{
              ...s.btn,
              background: 'var(--accent)',
              color: '#fff',
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Looks good'}
          </button>
          <button onClick={onDone} style={{ ...s.btn, ...s.btnSecondary }}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '32px 28px 24px',
    maxWidth: 380,
    width: '100%',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    margin: '0 0 8px',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
    margin: '0 0 8px',
  },
  sub: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    margin: '0 0 20px',
    fontWeight: 450,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-hi)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 8,
    letterSpacing: '-0.01em',
  },
  error: {
    fontSize: 12,
    color: 'var(--bad)',
    margin: '4px 0 0',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    fontSize: 13,
    fontWeight: 650,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    letterSpacing: '-0.01em',
  },
  btnSecondary: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
}
