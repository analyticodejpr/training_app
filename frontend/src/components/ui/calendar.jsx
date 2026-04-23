/**
 * shadcn-style Calendar wrapping react-day-picker v9.
 * Styled entirely with CSS variables — no react-day-picker CSS import.
 */
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Calendar({ className, classNames, ...props }) {
  return (
    <DayPicker
      className={cn('calendar-root', className)}
      classNames={{
        months:          'cal-months',
        month:           'cal-month',
        month_caption:   'cal-caption',
        caption_label:   'cal-caption-label',
        nav:             'cal-nav',
        button_previous: 'cal-nav-btn cal-nav-prev',
        button_next:     'cal-nav-btn cal-nav-next',
        month_grid:      'cal-grid',
        weekdays:        'cal-weekdays',
        weekday:         'cal-weekday',
        week:            'cal-week',
        day:             'cal-day',
        day_button:      'cal-day-btn',
        selected:        'cal-selected',
        range_start:     'cal-range-start',
        range_middle:    'cal-range-mid',
        range_end:       'cal-range-end',
        today:           'cal-today',
        outside:         'cal-outside',
        disabled:        'cal-disabled',
        hidden:          'cal-hidden',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft size={14} strokeWidth={2} />
            : <ChevronRight size={14} strokeWidth={2} />,
      }}
      {...props}
    />
  )
}
