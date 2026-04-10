'use client'
import { useState, useEffect } from 'react'
import PostgameLoader from './PostgameLoader'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
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
      {hasChecked && !loaderDone && <PostgameLoader onFinish={handleFinish} />}
      <div
        style={{
          opacity: loaderDone ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        {children}
      </div>
    </>
  )
}
