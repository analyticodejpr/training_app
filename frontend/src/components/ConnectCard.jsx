export default function ConnectCard({ platform, message }) {
  const color = platform === 'WHOOP' ? 'var(--whoop)' : 'var(--accent)'

  async function connect() {
    const endpoint = platform === 'WHOOP' ? '/api/auth/whoop/url' : '/api/auth/strava/url'
    const r = await fetch(endpoint)
    const { url } = await r.json()
    window.location.href = url
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '32px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {message || `Connect ${platform} to unlock this section`}
      </span>
      <button onClick={connect} style={{
        padding: '9px 22px', borderRadius: 10,
        background: color, color: '#fff', fontWeight: 600,
        fontSize: 13, border: 'none', cursor: 'pointer',
        boxShadow: `0 4px 14px ${platform === 'WHOOP' ? 'rgba(0,212,170,0.3)' : 'rgba(252,76,2,0.3)'}`,
      }}>
        Connect {platform}
      </button>
    </div>
  )
}
