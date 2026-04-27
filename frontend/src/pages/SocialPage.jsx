/**
 * SocialPage — Social tab (route: /social)
 *
 * Mock social feed — friends, competitions, and training previews.
 * Athletes and Events tabs, friend detail and event detail views.
 */
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

// ── Mock data ──────────────────────────────────────────────────────────────────

const FRIENDS = [
  {
    id: 1, name: 'Sofia Reyes', city: 'Madrid', sport: 'Triathlon',
    avatar: '👩', recovery: 82, plan: 'Ironman 70.3 Build', weekKm: 62,
    schedule: [
      { day: 'Mon', type: 'swim',  label: 'Open Water 3km',    mins: 65,  color: '#22D3EE' },
      { day: 'Tue', type: 'run',   label: 'Tempo Run 12km',    mins: 75,  color: '#6366F1' },
      { day: 'Wed', type: 'rest',  label: 'Rest',              mins: 0,   color: '#E5E7EB' },
      { day: 'Thu', type: 'ride',  label: 'Long Ride 90km',    mins: 210, color: '#FB923C' },
      { day: 'Fri', type: 'run',   label: 'Easy Run 8km',      mins: 50,  color: '#6366F1' },
      { day: 'Sat', type: 'brick', label: 'Brick Session',     mins: 120, color: '#C084FC' },
      { day: 'Sun', type: 'rest',  label: 'Rest',              mins: 0,   color: '#E5E7EB' },
    ],
  },
  {
    id: 2, name: 'James Okafor', city: 'London', sport: 'Running',
    avatar: '👨', recovery: 55, plan: 'Marathon Build', weekKm: 75,
    schedule: [
      { day: 'Mon', type: 'run',  label: 'Easy 10km',          mins: 60,  color: '#6366F1' },
      { day: 'Tue', type: 'run',  label: 'Interval 6×1km',     mins: 65,  color: '#FBBF24' },
      { day: 'Wed', type: 'run',  label: 'Recovery Jog 7km',   mins: 45,  color: '#9CA3AF' },
      { day: 'Thu', type: 'run',  label: 'Tempo 14km',         mins: 85,  color: '#FB923C' },
      { day: 'Fri', type: 'rest', label: 'Rest',               mins: 0,   color: '#E5E7EB' },
      { day: 'Sat', type: 'run',  label: 'Long Run 30km',      mins: 175, color: '#059669' },
      { day: 'Sun', type: 'rest', label: 'Rest',               mins: 0,   color: '#E5E7EB' },
    ],
  },
  {
    id: 3, name: 'Anna Chen', city: 'Singapore', sport: 'Cycling',
    avatar: '👩', recovery: 35, plan: 'Gran Fondo Base', weekKm: 180,
    schedule: [
      { day: 'Mon', type: 'ride', label: 'Zone 2 Ride 50km',   mins: 100, color: '#6366F1' },
      { day: 'Tue', type: 'rest', label: 'Rest',               mins: 0,   color: '#E5E7EB' },
      { day: 'Wed', type: 'ride', label: 'Hill Repeats 60km',  mins: 120, color: '#FBBF24' },
      { day: 'Thu', type: 'ride', label: 'Easy Spin 40km',     mins: 80,  color: '#9CA3AF' },
      { day: 'Fri', type: 'rest', label: 'Rest',               mins: 0,   color: '#E5E7EB' },
      { day: 'Sat', type: 'ride', label: 'Long Ride 120km',    mins: 240, color: '#059669' },
      { day: 'Sun', type: 'ride', label: 'Recovery Ride 30km', mins: 60,  color: '#9CA3AF' },
    ],
  },
  {
    id: 4, name: 'Marco Bianchi', city: 'Milan', sport: 'Triathlon',
    avatar: '🧔', recovery: 71, plan: 'Sprint Tri Peak', weekKm: 45,
    schedule: [
      { day: 'Mon', type: 'swim', label: 'Pool Session 2km',   mins: 50,  color: '#22D3EE' },
      { day: 'Tue', type: 'run',  label: 'Fast Tempo 8km',     mins: 45,  color: '#FB923C' },
      { day: 'Wed', type: 'ride', label: 'Power Ride 50km',    mins: 95,  color: '#6366F1' },
      { day: 'Thu', type: 'rest', label: 'Rest',               mins: 0,   color: '#E5E7EB' },
      { day: 'Fri', type: 'swim', label: 'Open Water 1.5km',   mins: 40,  color: '#22D3EE' },
      { day: 'Sat', type: 'race', label: 'Sprint Triathlon',   mins: 75,  color: '#EF4444' },
      { day: 'Sun', type: 'rest', label: 'Recovery',           mins: 0,   color: '#E5E7EB' },
    ],
  },
  {
    id: 5, name: 'Priya Sharma', city: 'Mumbai', sport: 'Running',
    avatar: '👩', recovery: 90, plan: 'Half Marathon Build', weekKm: 55,
    schedule: [
      { day: 'Mon', type: 'run',  label: 'Easy 8km',            mins: 48,  color: '#6366F1' },
      { day: 'Tue', type: 'run',  label: 'Interval 5×800m',     mins: 55,  color: '#FBBF24' },
      { day: 'Wed', type: 'rest', label: 'Rest',                 mins: 0,   color: '#E5E7EB' },
      { day: 'Thu', type: 'run',  label: 'Tempo 10km',           mins: 60,  color: '#FB923C' },
      { day: 'Fri', type: 'run',  label: 'Easy 6km',             mins: 36,  color: '#6366F1' },
      { day: 'Sat', type: 'run',  label: 'Long Run 18km',        mins: 110, color: '#059669' },
      { day: 'Sun', type: 'rest', label: 'Rest',                 mins: 0,   color: '#E5E7EB' },
    ],
  },
]

const EVENTS = [
  {
    id: 1, name: 'London Marathon', date: '2026-04-26', type: 'Marathon',
    location: 'London, UK', participants: 45000, friendsTraining: 3,
    description: "One of the world's most iconic marathons. 26.2 miles through the heart of London.",
    typeColor: '#6366F1',
  },
  {
    id: 2, name: 'Ironman 70.3 Barcelona', date: '2026-05-17', type: 'Half Ironman',
    location: 'Barcelona, Spain', participants: 3200, friendsTraining: 2,
    description: '1.9km swim, 90km bike, 21.1km run along the stunning Costa Daurada coast.',
    typeColor: '#22D3EE',
  },
  {
    id: 3, name: 'Paris Half Marathon', date: '2026-03-01', type: 'Half Marathon',
    location: 'Paris, France', participants: 28000, friendsTraining: 4,
    description: 'Run through the streets of Paris with the Eiffel Tower as your backdrop.',
    typeColor: '#FB923C',
  },
  {
    id: 4, name: 'Berlin 10K', date: '2026-06-14', type: '10K',
    location: 'Berlin, Germany', participants: 12000, friendsTraining: 1,
    description: 'Fast, flat course through the Tiergarten. Perfect for a new PB.',
    typeColor: '#059669',
  },
  {
    id: 5, name: 'Challenge Roth', date: '2026-07-05', type: 'Ironman',
    location: 'Roth, Germany', participants: 5000, friendsTraining: 2,
    description: 'Widely regarded as the greatest triathlon experience in the world.',
    typeColor: '#C084FC',
  },
  {
    id: 6, name: 'Valencia Marathon', date: '2026-12-06', type: 'Marathon',
    location: 'Valencia, Spain', participants: 22000, friendsTraining: 2,
    description: 'One of the fastest marathon courses in the world. Perfect for a PB attempt.',
    typeColor: '#6366F1',
  },
  {
    id: 7, name: 'Zurich Triathlon Sprint', date: '2026-08-22', type: 'Sprint Tri',
    location: 'Zurich, Switzerland', participants: 2800, friendsTraining: 3,
    description: 'A beautiful sprint triathlon on the shores of Lake Zurich.',
    typeColor: '#FBBF24',
  },
]

// ── Recovery color ─────────────────────────────────────────────────────────────

function recColor(score) {
  if (score == null) return '#9CA3AF'
  if (score >= 67) return '#34D399'
  if (score >= 34) return '#FBBF24'
  return '#FB7185'
}

function formatEventDate(str) {
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [tab,        setTab]        = useState('athletes') // 'athletes' | 'events'
  const [search,     setSearch]     = useState('')
  const [joined,     setJoined]     = useState({})         // { `${friendId}-${dayIdx}`: true }
  const [friendView, setFriendView] = useState(null)       // friend object
  const [eventView,  setEventView]  = useState(null)       // event object

  if (friendView) {
    return (
      <FriendDetail
        friend={friendView}
        joined={joined}
        onJoin={(key) => setJoined(j => ({ ...j, [key]: !j[key] }))}
        onBack={() => setFriendView(null)}
      />
    )
  }

  if (eventView) {
    return (
      <EventDetail
        event={eventView}
        friends={FRIENDS}
        onFriend={setFriendView}
        onBack={() => setEventView(null)}
      />
    )
  }

  const lc = search.toLowerCase()
  const filteredFriends = lc
    ? FRIENDS.filter(f =>
        f.name.toLowerCase().includes(lc) ||
        f.city.toLowerCase().includes(lc) ||
        f.sport.toLowerCase().includes(lc)
      )
    : FRIENDS

  const filteredEvents = lc
    ? EVENTS.filter(e =>
        e.name.toLowerCase().includes(lc) ||
        e.type.toLowerCase().includes(lc) ||
        e.location.toLowerCase().includes(lc)
      )
    : EVENTS

  return (
    <div style={pageWrap}>

      {/* Search */}
      <div style={{
        background: '#fff', border: '1px solid #EAECF0',
        borderRadius: 14, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes, cities, events…"
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 14,
            color: '#1A1B23', background: 'transparent', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Tab toggle */}
      <div style={{
        display: 'flex', background: '#F3F4F6',
        borderRadius: 14, padding: 4, gap: 4,
      }}>
        {[['athletes', 'Athletes'], ['events', 'Events']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '9px 0',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? '#1A1B23' : '#9CA3AF',
              boxShadow: tab === key ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'athletes' ? (
        <>
          {/* Horizontal avatar strip */}
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {filteredFriends.map(f => (
              <button
                key={f.id}
                onClick={() => setFriendView(f)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, border: '2px solid #EAECF0',
                  }}>
                    {f.avatar}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 14, height: 14, borderRadius: '50%',
                    background: recColor(f.recovery), border: '2px solid #fff',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1B23', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                  {f.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Friend cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredFriends.map(f => (
              <div
                key={f.id}
                onClick={() => setFriendView(f)}
                style={friendCard}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>
                      {f.avatar}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 12, height: 12, borderRadius: '50%',
                      background: recColor(f.recovery), border: '2px solid #fff',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em' }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{f.sport} · {f.city}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.plan}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: recColor(f.recovery) }}>{f.recovery}%</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Recovery</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginTop: 4 }}>{f.weekKm} km/wk</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredEvents.map(ev => (
            <div
              key={ev.id}
              onClick={() => setEventView(ev)}
              style={friendCard}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${ev.typeColor}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {ev.type === 'Marathon' || ev.type === 'Half Marathon' || ev.type === '10K' ? '🏃' :
                   ev.type.includes('Ironman') || ev.type.includes('Tri') ? '🏊' : '🎯'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em' }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{ev.location}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{formatEventDate(ev.date)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    background: `${ev.typeColor}18`, color: ev.typeColor,
                    borderRadius: 8, padding: '3px 8px',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {ev.type}
                  </span>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                    👥 {ev.friendsTraining} training
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}

// ── Friend detail view ────────────────────────────────────────────────────────

function FriendDetail({ friend, joined, onJoin, onBack }) {
  const todayIdx = (() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1
  })()

  return (
    <div style={pageWrap}>
      {/* Back */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 0 }}>
        <ArrowLeft size={18} /> Back
      </button>

      {/* Hero */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EAECF0', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>{friend.avatar}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.03em' }}>{friend.name}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{friend.sport} · {friend.city}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: recColor(friend.recovery) }}>{friend.recovery}%</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Recovery</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1B23' }}>{friend.weekKm}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>km/wk</div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '8px 14px', background: '#F5F6FA', borderRadius: 10, display: 'inline-block' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6366F1' }}>📋 {friend.plan}</span>
        </div>
      </div>

      {/* This week schedule */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EAECF0', padding: '18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>
          This Week's Training
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {friend.schedule.map((day, i) => {
            const isToday = i === todayIdx
            const key = `${friend.id}-${i}`
            const isJoined = joined[key]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                borderRadius: 14,
                background: isToday ? '#F5F3FF' : '#F9FAFB',
                border: `1px solid ${isToday ? '#C7D2FE' : '#F3F4F6'}`,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: day.type === 'rest' ? '#F3F4F6' : `${day.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: day.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', letterSpacing: '-0.01em' }}>{day.day}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B23', letterSpacing: '-0.02em', marginTop: 1 }}>{day.label}</div>
                  {day.mins > 0 && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{day.mins} min</div>}
                </div>
                {day.type !== 'rest' && (
                  <button
                    onClick={() => onJoin(key)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12, fontWeight: 700,
                      background: isJoined ? '#D1FAE5' : '#6366F1',
                      color: isJoined ? '#059669' : '#fff',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                  >
                    {isJoined ? '✓ Joined' : 'Join'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ height: 8 }} />
    </div>
  )
}

// ── Event detail view ─────────────────────────────────────────────────────────

function EventDetail({ event, friends, onFriend, onBack }) {
  return (
    <div style={pageWrap}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 0 }}>
        <ArrowLeft size={18} /> Back
      </button>

      {/* Hero */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EAECF0', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `${event.typeColor}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0,
          }}>
            {event.type === 'Marathon' || event.type === 'Half Marathon' || event.type === '10K' ? '🏃' :
             event.type.includes('Ironman') || event.type.includes('Tri') ? '🏊' : '🎯'}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.03em', lineHeight: 1.2 }}>{event.name}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{event.location}</div>
            <span style={{ display: 'inline-block', marginTop: 8, background: `${event.typeColor}18`, color: event.typeColor, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>
              {event.type}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
          <StatCell label="Date" value={formatEventDate(event.date)} />
          <StatCell label="Athletes" value={event.participants.toLocaleString()} />
          <StatCell label="Friends" value={`${event.friendsTraining} training`} />
        </div>

        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
          {event.description}
        </p>
      </div>

      {/* Friends training for this event */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EAECF0', padding: '18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}>
          Friends Training for This
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {friends.slice(0, event.friendsTraining).map(f => (
            <button
              key={f.id}
              onClick={() => onFriend(f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                background: '#F9FAFB', border: '1px solid #F3F4F6',
                borderRadius: 12, padding: '12px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 24 }}>{f.avatar}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23' }}>{f.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{f.plan}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 18, color: '#9CA3AF' }}>›</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 8 }} />
    </div>
  )
}

function StatCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

const pageWrap = {
  padding: '16px 16px 0',
  display: 'flex', flexDirection: 'column', gap: 12,
}

const friendCard = {
  background: '#fff', border: '1px solid #EAECF0',
  borderRadius: 20, padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer',
}
