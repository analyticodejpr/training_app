import { useState, useEffect } from 'react'

export function useDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= breakpoint
  )
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isDesktop
}
