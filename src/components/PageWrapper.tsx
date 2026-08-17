'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import PostgameLoader from './PostgameLoader'

// Routes that carry no Postgame branding at all — the loader draws the Postgame
// mark, so client-campaign surfaces have to skip it. SiteNav hides itself on the
// same prefixes via its own HIDDEN_ROUTES list.
const NO_LOADER_ROUTES = ['/quiz/']

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const skipLoader = NO_LOADER_ROUTES.some(r => pathname?.startsWith(r))
  const [loaderDone, setLoaderDone] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem('postgame_loader_seen') === 'true') {
        setLoaderDone(true)
      }
    } finally {
      setHasChecked(true)
    }
  }, [])

  const handleFinish = () => {
    try {
      sessionStorage.setItem('postgame_loader_seen', 'true')
    } catch {
      // ignore (e.g. private mode / quota)
    }
    setLoaderDone(true)
  }

  return (
    <>
      {hasChecked && !loaderDone && !skipLoader && <PostgameLoader onFinish={handleFinish} />}
      <div
        style={{
          opacity: loaderDone || skipLoader ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        {children}
      </div>
    </>
  )
}
