import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes without conflicts.
 * Used by shadcn/ui components and any component that accepts a `className` prop.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
