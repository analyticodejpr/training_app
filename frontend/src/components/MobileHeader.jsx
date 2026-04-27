import { useState } from 'react'
import { Bell, RefreshCw } from 'lucide-react'

export default function MobileHeader({ onSync }) {
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
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: '#6366F1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>Z</span>
        </div>
        <span style={{
          fontSize: 20, fontWeight: 800,
          letterSpacing: '-0.05em', color: '#1A1B23', lineHeight: 1,
        }}>
          ZO<span style={{ color: '#6366F1' }}>N</span>E
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={iconBtnStyle} aria-label="Notifications">
          <Bell size={18} color="#4B5563" strokeWidth={1.8} />
        </button>
        <button onClick={handleSync} style={iconBtnStyle} aria-label="Sync">
          <RefreshCw
            size={18}
            color={syncing ? '#6366F1' : '#4B5563'}
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
