import { createContext, useContext, useState, useMemo } from 'react'

export const PERIODS = [
  { key: 'today',   label: 'Today',    days: 1   },
  { key: '7d',      label: '7 Days',   days: 7   },
  { key: '30d',     label: '30 Days',  days: 30  },
  { key: '90d',     label: '3 Months', days: 90  },
  { key: 'all',     label: 'All Time', days: 9999 },
]

const DateRangeContext = createContext(null)

export function DateRangeProvider({ children }) {
  const [period, setPeriod] = useState('30d')

  const { days, label } = useMemo(() => PERIODS.find(p => p.key === period), [period])

  const cutoff = useMemo(() => {
    if (days >= 9999) return null
    const d = new Date(Date.now() - days * 86_400_000)
    d.setHours(0, 0, 0, 0)
    return d
  }, [days])

  /** Filter any array with a .date string field by the current cutoff. */
  function filterByDate(arr, getDate = d => d.date) {
    if (!cutoff) return arr
    return arr.filter(d => new Date(getDate(d)) >= cutoff)
  }

  /** Filter Strava activities by start date. */
  function filterActivities(activities) {
    return filterByDate(activities, a => (a.start_date_local || a.start_date || '').split('T')[0])
  }

  return (
    <DateRangeContext.Provider value={{ period, setPeriod, days, label, cutoff, filterByDate, filterActivities }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used inside DateRangeProvider')
  return ctx
}
