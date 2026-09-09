'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import PostgameLoader from './PostgameLoader'

// Routes that carry no Postgame branding at all — the loader draws the Postgame
// mark, so client-campaign surfaces have to skip it. SiteNav hides itself on the
// same prefixes via its own HIDDEN_ROUTES list.
//
// The signed-in APP surfaces are skipped too. The loader is public-site chrome:
// it covers the screen and holds the page at opacity 0 until it finishes, which
// on an authenticated surface is a blank screen and a delay in front of
// someone who has already arrived. It also made the brand dashboard render as a
// near-black page on first load, which is how this was noticed.
//
// startsWith() prefixes, and deliberately WITHOUT trailing slashes so the bare
// route matches too — a trailing "/" is what once let the marketing header
// render over /portal itself while hiding it on /portal/anything.
const NO_LOADER_ROUTES = [
  '/quiz/',
  '/portal',
  '/dashboard',
  '/athlete',
  '/admin',
  '/board',
]

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
