import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

const BRAND    = '#e04e1f'
const BRAND_LT = '#f47c20'

export default function MobileHeader({ onSync, onChatOpen }) {
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState(false)

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setToast(true)
    try {
      await onSync?.()
    } finally {
      setTimeout(() => {
        setSyncing(false)
        setToast(false)
      }, 1400)
    }
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
      padding: 'max(env(safe-area-inset-top, 0px), 14px) 20px 12px',
      background: 'rgba(245,246,250,0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid #EAECF0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <img
          src="/logo.svg"
          alt="Logo"
          style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }}
        />
        <span style={{
          fontSize: 20, fontWeight: 800,
          letterSpacing: '-0.05em', color: '#1A1B23', lineHeight: 1,
        }}>
          ZO<span style={{ color: '#e04e1f' }}>N</span>E
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onChatOpen} style={iconBtnStyle} aria-label="Training Assistant">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke="#4B5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
        <button onClick={handleSync} style={iconBtnStyle} aria-label="Sync">
          <RefreshCw
            size={18}
            color={syncing ? '#e04e1f' : '#4B5563'}
            strokeWidth={1.8}
            style={{
              transition: 'transform 1.2s linear',
              transform: syncing ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </div>

      {/* Sync toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: -44, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1A1B23', color: '#fff',
          borderRadius: 20, padding: '8px 16px',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 60, pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          Syncing Strava & WHOOP…
        </div>
      )}
    </header>
  )
}

const iconBtnStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: '#fff', border: '1px solid #EAECF0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
}
