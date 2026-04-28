import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabaseMetrics }    from '../hooks/useSupabaseMetrics'
import { useSupabaseActivities } from '../hooks/useSupabaseActivities'
import { usePlannerGoal, useCurrentWeekSchedule } from '../hooks/usePlanner'

const BRAND     = '#e04e1f'
const BRAND_LT  = '#f47c20'

// ── Tiny SVG charts ────────────────────────────────────────────────────────────

function SparkLine({ data, color = BRAND, width = 88, height = 28 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ])
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaD = d + ` L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DonutRing({ value, size = 52, stroke = 5, color, children }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const fill = Math.min(value / 100, 1) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill.toFixed(2)} ${circ.toFixed(2)}`}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      {children}
    </svg>
  )
}

function StackedBarChart({ data, width = 420, height = 160 }) {
  if (!data.length) return null
  const pad = { t: 8, r: 8, b: 24, l: 8 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const totals = data.map(d => d.run + d.ride + d.swim)
  const max    = Math.max(...totals, 1)
  const barW   = (W / data.length) * 0.55
  const gap    = (W / data.length)

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = pad.t + f * H
        return <line key={i} x1={pad.l} y1={y} x2={pad.l + W} y2={y} stroke="#F3F4F6" strokeWidth={1} />
      })}
      {data.map((d, i) => {
        const x  = pad.l + i * gap + (gap - barW) / 2
        const layers = [
          { val: d.run,  color: BRAND },
          { val: d.ride, color: '#22D3EE' },
          { val: d.swim, color: '#34D399' },
        ]
        let yOff = pad.t + H
        return (
          <g key={i}>
            {layers.map((l, li) => {
              const bh = (l.val / max) * H
              yOff -= bh
              return (
                <rect key={li} x={x} y={yOff} width={barW} height={bh}
                  fill={l.color} opacity={0.85}
                  rx={li === layers.length - 1 ? 3 : 0} />
              )
            })}
            <text x={x + barW / 2} y={pad.t + H + 16} textAnchor="middle"
              fontSize="9" fill="#9CA3AF">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function MultiLineChart({ recovery, strain, labels, width = 320, height = 160 }) {
  if (!recovery.length) return null
  const pad = { t: 10, r: 10, b: 22, l: 28 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const allVals = [...recovery, ...strain.map(v => v * 5)]
  const max = Math.max(...allVals, 100), min = 0, range = max - min

  function path(data) {
    const pts = data.map((v, i) => ({
      x: pad.l + (i / (data.length - 1)) * W,
      y: pad.t + H - ((v - min) / range) * H,
    }))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = pad.t + f * H
        return <g key={i}>
          <line x1={pad.l} y1={y} x2={pad.l + W} y2={y} stroke="#F3F4F6" strokeWidth={1} />
          <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9CA3AF">
            {Math.round(max - f * max)}
          </text>
        </g>
      })}
      {labels.map((l, i) => (
        <text key={i} x={pad.l + (i / (labels.length - 1)) * W} y={pad.t + H + 14}
          textAnchor="middle" fontSize="9" fill="#9CA3AF">{l}</text>
      ))}
      <path d={path(recovery)} fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(strain.map(v => v * 5))} fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recoveryColor(score) {
  if (score == null) return '#9CA3AF'
  if (score >= 67)   return '#34D399'
  if (score >= 34)   return '#FBBF24'
  return '#FB7185'
}

function fmtDist(m) {
  return m ? `${(m / 1000).toFixed(1)} km` : '—'
}

function fmtDur(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const SPORT_STYLE = {
  Run:  { color: BRAND,     bg: `rgba(224,78,31,0.08)`,  icon: '🏃' },
  Ride: { color: '#22D3EE', bg: 'rgba(34,211,238,0.1)',  icon: '🚴' },
  Swim: { color: '#059669', bg: 'rgba(52,211,153,0.1)',  icon: '🏊' },
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub, color, ring, trend, icon }) {
  return (
    <div style={S.kpiCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: 13, color: color + '99' }}>{icon}</div>
      </div>

      {ring ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <DonutRing value={value ?? 0} size={52} stroke={5} color={color}>
            <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{value ?? '—'}</text>
          </DonutRing>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {value ?? '—'}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {value ?? '—'}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{unit}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>
        </div>
      )}

      <SparkLine data={trend} color={color} />
    </div>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ act }) {
  const cfg  = SPORT_STYLE[act.type] || { color: '#6B7280', bg: '#F5F6FA', icon: '◎' }
  const dist = fmtDist(act.distance)
  const dur  = fmtDur(act.moving_time)
  return (
    <div style={S.actRow}>
      <div style={{ ...S.actIcon, background: cfg.bg, color: cfg.color }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {act.name}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
          {act.start_date ? new Date(act.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
          {act.avg_heart_rate ? ` · ${Math.round(act.avg_heart_rate)} bpm` : ''}
          {act.total_elevation_gain ? ` · ${Math.round(act.total_elevation_gain)}m ↑` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{dist}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{dur}</div>
      </div>
    </div>
  )
}

// ── Today's recommendation ────────────────────────────────────────────────────

function TodayRec({ recovery, goal, firstSession, lifecycle, onNav }) {
  const recColor = recoveryColor(recovery)
  const reco = recovery == null ? null
    : recovery >= 67
      ? { label: 'Green — Go Hard',    msg: 'Recovery is strong. A quality session is optimal today.',   icon: '🟢' }
      : recovery >= 34
        ? { label: 'Yellow — Moderate', msg: 'Moderate recovery. Keep intensity controlled today.',         icon: '🟡' }
        : { label: 'Red — Rest',        msg: 'Low recovery. Prioritise rest or light movement.',            icon: '🔴' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reco && (
        <div style={{ border: `1px solid ${recColor}40`, borderRadius: 10, padding: '10px 12px', background: recColor + '0D' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: recColor, boxShadow: `0 0 6px ${recColor}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: recColor }}>{reco.label}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{reco.msg}</div>
        </div>
      )}

      {firstSession && lifecycle === 'active' ? (
        <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Today's Scheduled Session</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1B23' }}>
            {firstSession.sport} {firstSession.session_type}
          </div>
          {firstSession.prescribed_minutes && (
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{firstSession.prescribed_minutes} min</div>
          )}
        </div>
      ) : goal ? (
        <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Active Plan</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1B23' }}>
            {goal.goal_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
          {goal.event_date && (
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {new Date(goal.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => onNav('/training')} style={{ padding: '12px', background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`, border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: '#fff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, marginBottom: 5 }}>Training Plan</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Create your personalised plan →</div>
        </button>
      )}
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────

const BOT_INTRO = "Hi! I'm your training assistant. Ask me anything about your training, recovery, or upcoming plan."

const CANNED = [
  { match: /\b(hi|hello|hey)\b/i,          reply: "Hey! How's training going? Ask me about your recovery, workouts, or plan." },
  { match: /recovery/i,                     reply: "Recovery is key. Based on your WHOOP data, aim for green-zone days before hard sessions. Anything specific you want to know?" },
  { match: /\b(run|running)\b/i,            reply: "Running sessions are in your plan. Focus on easy aerobic pace for base builds — most athletes train too hard on easy days." },
  { match: /\b(ride|cycling|bike)\b/i,      reply: "Cycling is great for aerobic base with lower impact. How are your legs feeling after recent rides?" },
  { match: /hrv/i,                          reply: "HRV (heart rate variability) is one of the best daily readiness signals. A drop >10% from your baseline warrants an easy day." },
  { match: /\b(plan|training plan)\b/i,     reply: "Your training plan is built around your goal and current fitness. Head to the Plan Builder to see the full breakdown." },
  { match: /\b(rest|recovery day)\b/i,      reply: "Rest days are training too — that's when adaptation happens. Don't skip them when your plan calls for them." },
  { match: /\b(tired|fatigue|fatigued)\b/i, reply: "Feeling tired? Check your WHOOP recovery score. If strain has been high for 3+ days, an easy day will pay dividends." },
  { match: /strava/i,                       reply: "Strava syncs your activity data automatically. You can also trigger a manual import from the Account page." },
  { match: /whoop/i,                        reply: "WHOOP tracks your recovery, strain, and sleep quality. Connect it in Settings to get personalised readiness scores." },
]

function botReply(text) {
  for (const c of CANNED) {
    if (c.match.test(text)) return c.reply
  }
  return "Good question! I don't have a specific answer yet, but your training data is all in the dashboard. What else can I help with?"
}

function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([{ role: 'bot', text: BOT_INTRO }])
  const [input, setInput]       = useState('')
  const [typing, setTyping]     = useState(false)
  const bottomRef               = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(m => [...m, { role: 'bot', text: botReply(text) }])
    }, 700 + Math.random() * 500)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 1000 }}
        />
      )}

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380,
        background: '#FFFFFF',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
        zIndex: 1001,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        borderLeft: '1px solid #E5E7EB',
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px',
          borderBottom: '1px solid #F3F4F6',
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23' }}>Training Assistant</div>
            <div style={{ fontSize: 11, color: '#34D399', fontWeight: 600 }}>● Online</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#9CA3AF', borderRadius: 6, lineHeight: 1 }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'bot' && (
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 7, marginTop: 2,
                }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
              )}
              <div style={{
                maxWidth: '78%',
                padding: '9px 13px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? `linear-gradient(135deg,${BRAND},${BRAND_LT})` : '#F3F4F6',
                color: m.role === 'user' ? '#fff' : '#1A1B23',
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                {m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: '14px 14px 14px 4px', padding: '9px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF',
                    animation: 'chatDot 1.2s infinite',
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts — only visible before user sends anything */}
        {messages.length === 1 && (
          <div style={{ padding: '0 18px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['How\'s my recovery?', 'What\'s my plan this week?', 'Should I train today?'].map(p => (
              <button key={p} onClick={() => { setInput(p); }} style={{
                padding: '5px 11px', border: '1px solid #E5E7EB', borderRadius: 20,
                background: '#F9FAFB', fontSize: 11, color: '#6B7280', cursor: 'pointer',
                fontWeight: 500,
              }}>{p}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask me anything…"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '8px 12px',
              fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
              outline: 'none', color: '#1A1B23',
              background: '#F9FAFB',
              maxHeight: 100, overflowY: 'auto',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: input.trim() ? `linear-gradient(135deg,${BRAND},${BRAND_LT})` : '#E5E7EB',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DesktopDashboard({ authStatus, user, onSync }) {
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)

  const { daily: whoopAll } = useSupabaseMetrics(!!authStatus?.whoop, 90)
  const { activities }      = useSupabaseActivities(true, 60)
  const { goal }            = usePlannerGoal()
  const { lifecycle, days: schedDays, sessions: schedSessions } = useCurrentWeekSchedule()

  const latest = whoopAll.length ? whoopAll[whoopAll.length - 1] : null
  const rec    = latest?.recovery_score
  const hrv    = latest?.hrv_rmssd
  const strain = latest?.strain

  // Today's session
  const todaySession = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayDay = schedDays.find(d => d.day_date?.slice(0, 10) === todayStr)
    if (!todayDay) return null
    return schedSessions.find(s => s.day_id === todayDay.id && s.session_type !== 'rest') || null
  }, [schedDays, schedSessions])

  // Weekly distance by sport (this week)
  const weekDist = useMemo(() => {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() === 0 ? 6 : start.getUTCDay() - 1))
    start.setUTCHours(0, 0, 0, 0)
    const week = activities.filter(a => new Date(a.start_date) >= start)
    const sum = (type) => week.filter(a => a.type === type).reduce((s, a) => s + (a.distance || 0), 0) / 1000
    const total = (sum('Run') + sum('Ride') + sum('Swim')).toFixed(1)
    return { total, run: sum('Run').toFixed(1), ride: sum('Ride').toFixed(1), swim: sum('Swim').toFixed(1) }
  }, [activities])

  // Last 8 weeks stacked bar chart data
  const weeklyChartData = useMemo(() => {
    const weeks = []
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date()
      wStart.setUTCDate(wStart.getUTCDate() - (wStart.getUTCDay() === 0 ? 6 : wStart.getUTCDay() - 1) - i * 7)
      wStart.setUTCHours(0, 0, 0, 0)
      const wEnd = new Date(wStart); wEnd.setUTCDate(wEnd.getUTCDate() + 7)
      const wActs = activities.filter(a => {
        const d = new Date(a.start_date)
        return d >= wStart && d < wEnd
      })
      const sum = (type) => wActs.filter(a => a.type === type).reduce((s, a) => s + (a.distance || 0), 0) / 1000
      weeks.push({
        label: wStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace(' ', ' '),
        run:   sum('Run'),
        ride:  sum('Ride'),
        swim:  sum('Swim'),
      })
    }
    return weeks
  }, [activities])

  // 7-day WHOOP trend
  const whoop7 = useMemo(() => whoopAll.slice(-7), [whoopAll])
  const whoopLabels = whoop7.map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (whoop7.length - 1 - i))
    return d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1)
  })

  const recColor = recoveryColor(rec)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.eyebrow}>OVERVIEW</div>
          <h1 style={S.title}>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(!authStatus?.strava || !authStatus?.whoop) && (
            <button onClick={() => navigate('/account')} style={S.connectBtn}>
              <span style={{ color: BRAND }}>⚡</span> Connect Apps
            </button>
          )}
          <button
            onClick={() => setChatOpen(o => !o)}
            title="Training Assistant"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: chatOpen ? `linear-gradient(135deg,${BRAND},${BRAND_LT})` : '#F3F4F6',
              border: chatOpen ? 'none' : '1px solid #E5E7EB',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.18s, border 0.18s',
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke={chatOpen ? '#fff' : '#6B7280'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={S.kpiRow}>
        <KpiCard label="Recovery" value={rec != null ? Math.round(rec) : null} unit="%" sub="WHOOP Score"
          color={recColor} ring trend={whoop7.map(d => d.recovery_score)} icon="♥" />
        <KpiCard label="Day Strain" value={strain != null ? strain.toFixed(1) : null} unit="" sub="WHOOP Strain"
          color="#FB923C" trend={whoop7.map(d => d.strain)} icon="⚡" />
        <KpiCard label="Week Distance" value={weekDist.total} unit="km"
          sub={`Run ${weekDist.run}  ·  Ride ${weekDist.ride}  ·  Swim ${weekDist.swim}`}
          color={BRAND_LT} trend={weeklyChartData.map(w => w.run + w.ride + w.swim)} icon="◎" />
        <KpiCard label="HRV" value={hrv != null ? Math.round(hrv) : null} unit="ms" sub="Heart Rate Variability"
          color="#22D3EE" trend={whoop7.map(d => d.hrv_rmssd)} icon="〜" />
      </div>

      {/* Charts row */}
      <div style={S.row}>
        <div style={{ ...S.card, flex: 1.4 }}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.cardTitle}>Training Load</div>
              <div style={S.cardSub}>Weekly km · 8 weeks</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ c: BRAND, l: 'Run' }, { c: '#22D3EE', l: 'Ride' }, { c: '#34D399', l: 'Swim' }].map(x => (
                <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} />
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <StackedBarChart data={weeklyChartData} width={440} height={160} />
          </div>
        </div>

        <div style={{ ...S.card, flex: 1 }}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.cardTitle}>Recovery & Strain</div>
              <div style={S.cardSub}>7-day trend</div>
            </div>
          </div>
          {whoop7.length >= 2 ? (
            <>
              <div style={{ overflowX: 'auto' }}>
                <MultiLineChart
                  recovery={whoop7.map(d => d.recovery_score ?? 0)}
                  strain={whoop7.map(d => d.strain ?? 0)}
                  labels={whoopLabels}
                  width={300} height={150}
                />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                {[{ c: '#34D399', l: 'Recovery %' }, { c: '#FB923C', l: 'Strain ×5' }].map(x => (
                  <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} />
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: '#9CA3AF', fontSize: 13 }}>
              Connect WHOOP to see recovery trends
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={S.row}>
        <div style={{ ...S.card, flex: 1.4 }}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>Recent Activities</div>
            <button onClick={() => navigate('/activities')} style={S.linkBtn}>View all →</button>
          </div>
          {activities.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '12px 0' }}>
              {authStatus?.strava ? 'No activities yet. Import from Strava.' : 'Connect Strava to see activities.'}
            </div>
          ) : (
            activities.slice(0, 5).map(a => <ActivityRow key={a.id} act={a} />)
          )}
        </div>

        <div style={{ ...S.card, flex: 1 }}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>Today's Recommendation</div>
            <button onClick={() => navigate('/training')} style={S.linkBtn}>Plan →</button>
          </div>
          <TodayRec
            recovery={rec}
            goal={goal}
            firstSession={todaySession}
            lifecycle={lifecycle}
            onNav={navigate}
          />
        </div>
      </div>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:       { padding: '28px 32px', animation: 'fadeIn 0.25s ease' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  eyebrow:    { fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 },
  title:      { fontSize: 26, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.03em' },
  connectBtn: { padding: '7px 14px', background: `rgba(224,78,31,0.08)`, border: `1px solid rgba(224,78,31,0.25)`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 },
  kpiRow:     { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  kpiCard:    { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  row:        { display: 'flex', gap: 12, marginBottom: 16 },
  card:       { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle:  { fontSize: 14, fontWeight: 700, color: '#1A1B23' },
  cardSub:    { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  linkBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: BRAND, fontWeight: 600 },
  actRow:     { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F9FAFB' },
  actIcon:    { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 },
}
