import { useState, useRef, useEffect } from 'react'

const BRAND    = '#e04e1f'
const BRAND_LT = '#f47c20'

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

const BotAvatar = ({ size = 26 }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.31, flexShrink: 0,
    background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
      stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  </div>
)

export default function ChatPanel({ open, onClose, mobile = false }) {
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

  const panelStyle = mobile
    ? {
        position: 'fixed', inset: 0,
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        zIndex: 1001,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }
    : {
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380,
        background: 'var(--surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
        zIndex: 1001,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        borderLeft: '1px solid var(--border)',
      }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 1000 }}
        />
      )}

      <div style={panelStyle}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: mobile ? 'max(env(safe-area-inset-top,0px),16px) 18px 14px' : '16px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--surface)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg,${BRAND},${BRAND_LT})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Training Assistant</div>
            <div style={{ fontSize: 11, color: '#34D399', fontWeight: 600 }}>● Online</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#9CA3AF', borderRadius: 6, lineHeight: 1 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'bot' && <div style={{ marginRight: 7, marginTop: 2 }}><BotAvatar /></div>}
              <div style={{
                maxWidth: '78%',
                padding: '9px 13px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? `linear-gradient(135deg,${BRAND},${BRAND_LT})` : 'var(--surface-2)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
              }}>
                {m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BotAvatar />
              <div style={{
                background: 'var(--surface-2)', borderRadius: '14px 14px 14px 4px',
                padding: '9px 14px', display: 'flex', gap: 4, alignItems: 'center',
              }}>
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

        {/* Suggested prompts */}
        {messages.length === 1 && (
          <div style={{ padding: '0 18px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {["How's my recovery?", "What's my plan this week?", "Should I train today?"].map(p => (
              <button key={p} onClick={() => setInput(p)} style={{
                padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 20,
                background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 500,
              }}>{p}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: mobile ? `12px 14px max(env(safe-area-inset-bottom,0px),12px)` : '12px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0, background: 'var(--surface)',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask me anything…"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 12px',
              fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5,
              outline: 'none', color: 'var(--text)',
              background: 'var(--surface-2)',
              maxHeight: 100, overflowY: 'auto',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: input.trim() ? `linear-gradient(135deg,${BRAND},${BRAND_LT})` : 'var(--surface-3)',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
