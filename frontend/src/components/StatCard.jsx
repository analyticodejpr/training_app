const styles = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    marginBottom: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.1,
  },
  sub: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
}

export default function StatCard({ label, value, sub, color, style }) {
  return (
    <div style={{ ...styles.card, ...style }}>
      <div style={styles.label}>{label}</div>
      <div style={{ ...styles.value, color: color || 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
    </div>
  )
}
