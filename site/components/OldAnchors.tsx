'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { oldAnchor } from './oldAnchor'

/** On the docs' front page: an old address with a section goes to that section's page. */
export function OldAnchors() {
  const router = useRouter()
  useEffect(() => {
    const page = oldAnchor(location.hash)
    if (page) router.replace(page)
  }, [router])
  return null
}
