/**
 * DateRangePicker — shadcn-style date range picker.
 * Trigger button shows current range label.
 * Popover contains: preset shortcuts (left) + calendar (right).
 */
import { useState } from 'react'
import { format, subDays, startOfDay, endOfDay, isValid } from 'date-fns'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useDateRange } from '../context/DateRangeContext'
import { Calendar } from './ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

// ── Preset shortcuts ──────────────────────────────────────────────────────────
const PRESETS = [
  {
    label: 'Today',
    get range() {
      const d = startOfDay(new Date())
      return { from: d, to: endOfDay(new Date()) }
    },
  },
  {
    label: 'Last 7 days',
    get range() {
      return { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }
    },
  },
  {
    label: 'Last 30 days',
    get range() {
      return { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }
    },
  },
  {
    label: 'Last 3 months',
    get range() {
      return { from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }
    },
  },
  {
    label: 'All time',
    range: null,
  },
]

function formatRange(from, to, presetLabel) {
  if (presetLabel === 'All time') return 'All time'
  if (!from) return 'Select range'
  if (!to) return format(from, 'MMM d, yyyy')
  return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
}

export default function DateRangePicker() {
  const { from, to, presetLabel, setRange } = useDateRange()
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(null) // in-calendar draft before commit

  const displayLabel = presetLabel === 'All time'
    ? 'All time'
    : (from && to)
      ? `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
      : 'Select range'

  function handlePreset(preset) {
    if (preset.range === null) {
      setRange(null, null, 'All time')
    } else {
      setRange(preset.range.from, preset.range.to, preset.label)
    }
    setSelecting(null)
    setOpen(false)
  }

  function handleCalendarSelect(range) {
    // range = { from?: Date, to?: Date }
    setSelecting(range)
    if (range?.from && range?.to) {
      setRange(range.from, endOfDay(range.to), 'Custom')
      setOpen(false)
      setSelecting(null)
    } else if (range?.from) {
      // still selecting end date — don't close
    }
  }

  const calendarSelected = selecting ?? (from && to ? { from, to } : from ? { from } : undefined)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.15s',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <CalendarDays size={13} strokeWidth={1.8} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>{displayLabel}</span>
          <ChevronDown size={12} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8}>
        <div style={{ display: 'flex' }}>

          {/* ── Left: preset shortcuts ── */}
          <div style={{
            padding: '12px 8px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 140,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              padding: '4px 8px 8px',
            }}>
              Quick select
            </div>
            {PRESETS.map(p => {
              const isActive = presetLabel === p.label
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: isActive ? 650 : 450,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    transition: 'background 0.12s, color 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--surface-2)'
                      e.currentTarget.style.color = 'var(--text)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-muted)'
                    }
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* ── Right: calendar ── */}
          <div>
            <Calendar
              mode="range"
              selected={calendarSelected}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              defaultMonth={from ? new Date(from.getFullYear(), from.getMonth()) : undefined}
            />
            {selecting?.from && !selecting?.to && (
              <div style={{
                padding: '0 16px 12px',
                fontSize: 11,
                color: 'var(--text-dim)',
                letterSpacing: '-0.01em',
              }}>
                Pick an end date
              </div>
            )}
          </div>

        </div>
      </PopoverContent>
    </Popover>
  )
}
