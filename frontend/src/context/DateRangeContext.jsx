import { createContext, useContext, useState, useMemo } from 'react'
import { subDays, startOfDay, endOfDay } from 'date-fns'

// Kept for any components still referencing PERIODS
export const PERIODS = [
  { key: 'today',   label: 'Today',         days: 1    },
  { key: '7d',      label: 'Last 7 days',   days: 7    },
  { key: '30d',     label: 'Last 30 days',  days: 30   },
  { key: '90d',     label: 'Last 3 months', days: 90   },
  { key: 'all',     label: 'All time',      days: 9999 },
]

const DateRangeContext = createContext(null)

function defaultRange() {
  return {
    from: startOfDay(subDays(new Date(), 29)),
    to:   endOfDay(new Date()),
  }
}

export function DateRangeProvider({ children }) {
  const [from,        setFrom]        = useState(() => defaultRange().from)
  const [to,          setTo]          = useState(() => defaultRange().to)
  const [presetLabel, setPresetLabel] = useState('Last 30 days')

  /** Set from a calendar selection or preset. Pass null/null for "All time". */
  function setRange(newFrom, newTo, label = 'Custom') {
    setFrom(newFrom ?? null)
    setTo(newTo ?? null)
    setPresetLabel(label)
  }

  const label = presetLabel

  /** Filter any array with a .date string field by from/to. */
  function filterByDate(arr, getDate = d => d.date) {
    if (!from && !to) return arr
    return arr.filter(d => {
      const date = new Date(getDate(d))
      if (from && date < from) return false
      if (to   && date > to  ) return false
      return true
    })
  }

  /** Filter Strava activities by start date. */
  function filterActivities(activities) {
    return filterByDate(activities, a =>
      (a.start_date_local || a.start_date || '').split('T')[0]
    )
  }

  // Backward-compat: cutoff = from (start of range)
  const cutoff = from

  return (
    <DateRangeContext.Provider value={{
      from, to, setRange,
      presetLabel, label,
      cutoff,
      filterByDate, filterActivities,
    }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used inside DateRangeProvider')
  return ctx
}
